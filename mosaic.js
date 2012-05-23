require(['jquery', 'lib/nokia-map', 'util', 'ranking', 'handlers', 'display-canvas'], function ($, nokiaMap, util, rankingFuncs, handlers, displayCanvas) {
    "use strict";
 
    // 128 or 256
    var sourceTileSize = 128;
    // Must be divide-able by source size
    var targetTileSize;
    var tilesPerSourceTile;
    var tileColumns;
    var tileRows;
    var tilesTotal;
    var tilesLoaded;
    var mosaicTiles;
    var mapTiles;
    var mapTilesToFetch;
    var tileType;
    var scratchCanvas = $('<canvas></canvas>').appendTo('#scratch')[0];
    var scratchCtx = scratchCanvas.getContext('2d');
    var sourceImageTiles;
    var sourceImage;
    var progressValue;
    var progressTotal;

    var rankingFunc = rankingFuncs.calcAvgColor;

    var statusMessage = function (message) {
        console.log(message);
        $('#statusMessage').text(message);
    };

    var readSourceImageData = function () {
        var x, y;

        statusMessage('Reading source image');

        sourceImageTiles = [];

        scratchCanvas.width = sourceImage.width;
        scratchCanvas.height = sourceImage.height;
        scratchCtx.drawImage(sourceImage, 0, 0);

        tilesLoaded = 0;
        tilesTotal = (sourceImage.width / targetTileSize) * (sourceImage.height / targetTileSize);
        resetProgress(tilesTotal);
        for (x = 0; x * targetTileSize < sourceImage.width; ++x) {
            for (y = 0; y * targetTileSize < sourceImage.height; ++y) {
                (function (x, y) {
                    setTimeout(function () {
                        var imageTile = {};

                        imageTile.x = x * targetTileSize;
                        imageTile.y = y * targetTileSize;
                        imageTile.imageData = scratchCtx.getImageData(y * targetTileSize, x * targetTileSize, targetTileSize, targetTileSize);

                        sourceImageTiles.push(imageTile);
                        increaseProgress();
                    }, 10);
                })(x, y);
            }
        }
    };

    var initTileDisplay = function () {
        displayCanvas.init(tileColumns, tileRows, targetTileSize);
    };

    var fetchMapTiles = function () {
        var timerStop = timerStart('fetching');
        statusMessage('Fetching and splitting ' + mapTilesToFetch + ' tiles of ' + sourceTileSize + 'px from server');

        tilesTotal = tileColumns * tileRows;
        tilesLoaded = 0;
        mapTiles = [];

        $('#raw-tiles').empty();
        resetProgress(mapTilesToFetch * tilesPerSourceTile);
        for (var i=0; i < mapTilesToFetch; ++i) {
            var tileUrl = nokiaMap.getTileUrl(15, 17640 + util.getRandomInt(-100, 100), 10755 + util.getRandomInt(-100, 100), sourceTileSize, tileType);
            fetchMapTileAndSplit(tileUrl);
        }

        waitForProcessDone(function () {
            timerStop();
            calcTilesRankingAndDisplay();
        });
    };

    var fetchMapTileAndSplit = function (url) {   
        var sourceMapTile;
        var targetTile;
        var x, y;

        sourceMapTile = new Image();
        sourceMapTile.crossOrigin = "anonymous";
        sourceMapTile.src = url;

        $('#raw-tiles').append(sourceMapTile);

        sourceMapTile.onload = function () {
            scratchCanvas.width = sourceTileSize;
            scratchCanvas.height = sourceTileSize;
            scratchCtx.drawImage(sourceMapTile, 0, 0);

            for (x = 0; x * targetTileSize < sourceTileSize; ++x) {
                for (y = 0; y * targetTileSize < sourceTileSize; ++y) {
                    targetTile = {};

                    targetTile.imageData = scratchCtx.getImageData(x * targetTileSize, y * targetTileSize, targetTileSize, targetTileSize);
                    targetTile.url = url;

                    mapTiles.push(targetTile);
                    increaseProgress();
                }
            }

        };

        sourceMapTile.onerror = function () {
            increaseProgress(tilesPerSourceTile);
        };
    };

    var calcTilesRankingAndDisplay = function () {
        var timerStop = timerStart('ranking');
        statusMessage('Calculating tile ranking for ' + mapTiles.length + ' tiles');

        calcTilesRanking(mapTiles);

        waitForProcessDone(function () {
            timerStop();

            timerStop = timerStart('generate');
            generateMosaicBySimilarity();

            waitForProcessDone(function () {
                timerStop();
                timerStop = timerStart('display');
                displayMosaic();
                timerStop();
            });
        });
    };

    var timerStart = function (name) {
        var timeStart = new Date().getTime();
        return function () {
            var now = new Date().getTime();
            console.log(name + ' done in ' + (now - timeStart) + 'ms');
        };
    };

    var calcTilesRanking = function (tilesToRank) {
        resetProgress(tilesToRank.length);
        for (var i = 0; i < tilesToRank.length; ++i) {
            var tile = tilesToRank[i];
            // A-sync so progress update can be seen
            (function (theTile) {
                setTimeout(function () {
                    var now;
                    theTile.ranking = calcTileRanking(theTile);
                    
                    increaseProgress();

                }, 10);
            })(tile);
        }
    };

    var calcTileRanking = function (tile) {
        return rankingFunc(tile.imageData.data);
    };

    var waitForProcessDone = function (callback) {
        var waitHandle = setInterval(function () {
            if (progressDone()) {
                clearInterval(waitHandle);
                callback();
            }
        }, 100);
    };

    var sortTilesByRanking = function () {
        mapTiles.sort(function (a, b) {
            return a.ranking - b.ranking;
        });
    };

    var generateMosaicBySimilarity = function () {
        mosaicTiles = [];

        statusMessage('Generating Mosaic by image similarity');
        resetProgress(sourceImageTiles.length);

        // Iterate source image
        for (var batch=0; batch < sourceImageTiles.length; batch+=100) {
            (function (batch) {
                setTimeout(function () {
                    for (var i = batch; i < batch + 100 && i < sourceImageTiles.length; ++i) {
                        var tileMatchScore;
                        var matchedTile = mapTiles[0];
                        matchedTile.score = -999;

                        // Iterate map-tiles, find closest match for source tile
                        // TODO: this is the heavy loop, optimize here
                        for (var j = 0; j < mapTiles.length; ++j) {
                            tileMatchScore = calcTileMatch(sourceImageTiles[i], mapTiles[j]);

                            if (tileMatchScore > matchedTile.score) {
                                matchedTile = mapTiles[j];
                                matchedTile.score = tileMatchScore;
                            }
                        }

                        mosaicTiles.push(matchedTile);
                        increaseProgress();
                    }
                }, batch / 4);
            })(batch);
        }
    };

    var displayMosaic = function () {
        var i, tile, row, column;

        statusMessage('Rendering result');

        for (row=0; row < tileRows; ++row) {
            for (column=0; column < tileColumns; ++column) {
                tile = mosaicTiles[(row*tileRows) + column];

                displayCanvas.renderTile(tile, targetTileSize, row, column);
            }
        }
    };

    var calcTileMatch = function (imageTile, mapTile) {
        return -Math.abs(imageTile.ranking - mapTile.ranking);
    };

    var calcTileMatchRGB = function (imageTile, mapTile) {
        return 100 * (
            1.0 - ((
                Math.Abs(imageTile.ranking[0] - mapTile.ranking[0]) +
                    Math.Abs(imageTile.ranking[1] - mapTile.ranking[1]) +
                    Math.Abs(imageTile.ranking[2] - mapTile.ranking[2])
            ) / (256.0 * 3))
        );
    };

    var resetProgress = function (total) {
        progressValue = 0;
        progressTotal = total;
        updateProgress(progressValue, progressTotal);
    };

    var increaseProgress = function (amount) {
        amount = amount || 1;
        progressValue += amount;
        updateProgress(progressValue, progressTotal);
    };

    var progressDone = function () {
        return progressValue >= progressTotal;
    };

    var updateProgress = function (value, total) {
        var percentOfTotalAmount = Math.floor(total/100);
        if (value % percentOfTotalAmount === 0 || value === total) {
            $('#progress').attr('value', value);
            $('#progress').attr('max', total);
            $('#progress-value').text(value);
            $('#progress-total').text(total);
        }
    };

    var start = function () {
        var timerStop = timerStart('read source image');
        initTileDisplay();
        readSourceImageData();
        waitForProcessDone(function () {
            timerStop();
            calcTilesRanking(sourceImageTiles);
            waitForProcessDone(function () {
                fetchMapTiles();
            });
        });
    };

    handlers.init({
        setTileType:function (type) {
            tileType = type;
        },
        setTargetTileSize:function (size) {
            targetTileSize = size;
            tileColumns = Math.floor(512 / targetTileSize);
            tileRows = Math.floor(512 / targetTileSize);
            tilesPerSourceTile = (sourceTileSize / targetTileSize) * (sourceTileSize / targetTileSize);
        },
        setSourceImage:function (image) {
            sourceImage = image;
        },
        setMapTilesToFetch:function(number) {
            mapTilesToFetch = number;
        },
        getMapTilesToFetch:function () {
            return mapTilesToFetch;
        },
        getTilesPerSourceTile:function () {
            return tilesPerSourceTile;
        },
        start:start
    });

    start();
});
