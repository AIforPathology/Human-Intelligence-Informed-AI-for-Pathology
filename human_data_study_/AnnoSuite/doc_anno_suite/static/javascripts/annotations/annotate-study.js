//(function () {

var username;
var image_id;
var annotationData;
var imageCount;
var assignment;
var currentIndex;
var dbIndex; // recent progress in db
var labelDict;

// For localization annotation
var isDeepZoomImage = false;
var OSDviewer = null; // Openseadragon viewer
var anno = null; // Annotorious
var activeLabel = null; // The bbox type
var activeRegionType = "freehand"; // The region annotation type, could be freehand, circle, rect, polygon, or line
var localizationLabels = {}; // For the bbox type switch, all type 4 and type 5 labels

// Event tracker
const trackerEnabled = false;
const eyetrackerEnabled = false;
var trackerData = [];
var trackerConfig = {
    eventType: "",
    eventLog: "",
    eventTarget: "",
    imgW: 0,
    imgH: 0,
    imgAsp: 0,
    containerW: 0,
    containerH: 0,
    boundW: 0,
    boundH: 0,
    boundX: 0,
    boundY: 0,
    zoom: 0,
    imageZoom: 0,
    FPS: 0,
    mousePos: [],
    mousePosImg: [],
    LGazePos: [],
    RGazePos: [],
    LGazePosImg: [],
    RGazePosImg: [],
    LEyePos: [],
    REyePos: [],
    timestamp: "",
};
var currentEyeTrackerData = {
    LGazePos: [],
    RGazePos: [],
    LGazePosImg: [],
    RGazePosImg: [],
    LEyePos: [],
    REyePos: [],
    timestamp: 0,
};
var createAnnotationEvent = null;
var socket;
const screenWidth = 2560;
const screenHeight = 1440;
const marginTop = 0;
const marginLeft = 0;
// FPS
var startTime = Date.now();
var frame = 0;
var FPS = 0;
// zoom
var zoomRatio = 0;

// Customization
const breastCategory = ["lab_5"];
const breastLabels = ["lab_6", "lab_7", "lab_8", "lab_9"];
const prostateCategory = ["lab_10", "lab_20"];
const prostateLabels = [
    "lab_11",
    "lab_12",
    "lab_13",
    "lab_14",
    "lab_15",
    "lab_16",
    "lab_21",
    "lab_22",
    "lab_23",
    "lab_24",
    "lab_25",
    "lab_26",
    "lab_27",
];

var imageType = "None";

// Training
const numOfTrainImages = 4;
var showTrainingResults = false;
var formalID = 0;
var formalIndex = 0;

// DEBUG
var eyetrackerCount = 0;
var debugTime = 0;

/**
 * 1. get information: username
 * 2. get imageID from url address, identify annotation mode
 * 3. get image information
 */
$(document).ready(async function () {
    if (is_ready != "False") {
        var info;
        if (url_image_id != "None") {
            info = await getAnnotationInfo(url_image_id);
        } else {
            info = await getAnnotationInfo("");
        }
        annotationData = info["current_annotation_info"][0];
        username = info.current_username;
        image_id = info.current_user_image_id;
        assignment = info.current_user_assignment.split(";");
        currentIndex = assignment.indexOf(image_id);
        dbIndex = info.current_user_progress;
        imageCount = assignment.length;

        // TODO: ONLY For debugging purpose
        // $("#img-box").css("height", screenHeight + "px");
        // $("#training-welcome").css("height", screenHeight + "px");
        // $("#formal-welcome").css("height", screenHeight + "px");
        // $("#exit-welcome").css("height", screenHeight + "px");

        //console.log(info);
        calculateFPS();
        //record the login time
        let log = username + ":" + "login";
        //console.log(username, image_id, log);
        await updateAnnotationLog(username, image_id, log);

        let schemaData = await getLabelSchema();
        labelDict = schemaData["schema"];

        registerStudyEvents();
        //console.log(labelDict);
    }
});

function calculateFPS() {
    var time = Date.now();
    frame++;
    if (time - startTime > 1000) {
        FPS = (frame / ((time - startTime) / 1000)).toFixed(1);
        startTime = time;
        frame = 0;
    }
    window.requestAnimationFrame(calculateFPS);
}

/**
 * Only used for the user study
 */
function registerStudyEvents() {
    if (dbIndex >= imageCount - 1) {
        $("#training-welcome-text").css("display", "block");
        $("#start-train-btn").text("Continue the formal study");
    }
    if (currentIndex >= numOfTrainImages) {
        $("#start-train-btn").text("Continue the formal study");
    }

    $("#start-train-btn").click(function () {
        $("#training-welcome").css("display", "none");
        $("#annotate-box").css("display", "block");
        startApp();
    });
    $("#start-formal-btn").click(function () {
        $("#formal-welcome").css("display", "none");
        $("#annotate-box").css("display", "block");
        startFormal();
    });
    $("#exit-btn").click(async function () {
        $("#exit-welcome").css("display", "flex");
        $("#annotate-box").css("display", "none");
        // save text labels
        $(this).prop("disabled", true);
        let textLabelCount = $(".text-label").length;
        for (let i = 0; i < textLabelCount; i++) {
            let label_id = $(".text-label")[i].id;
            let text = $("#" + label_id).val();
            await updateLabel(username, image_id, label_id, text, "str");
            saveTextTracker(label_id, text);
        }
        showFeedback();
        await sleep(500);
        removeFeedback();

        if (eyetrackerEnabled && trackerEnabled) {
            socket.emit("my_event", { data: "end_eye_tracking" });
            console.log("end_eye_tracking");
        }

        let currentConfig1 = { ...trackerConfig };
        currentConfig1 = getOSDViewerParams(currentConfig1);
        currentConfig1["eventType"] = "next_btn_clicked";
        currentConfig1["eventTarget"] = "OSDViewer";
        trackerData.push(currentConfig1);

        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "click_button";
        currentConfig["eventTarget"] = "HTMLUI";
        currentConfig["eventLog"] = `exit_study`;
        trackerData.push(currentConfig);
        //console.log("UI: exit study", currentConfig);

        let tracker = JSON.stringify(trackerData);
        //await updateLabel(username, image_id, "tracker", tracker, "str");
        await updateTrackerData(username, image_id, tracker);
        console.log("save tracker data");
    });
}

/**
 * start the program
 * Register events, formatter for annotorious, and the annotation
 */
function startApp() {
    if (eyetrackerEnabled && trackerEnabled) {
        registerSocketIO();
    }
    initFormatter();
    showAnnotationResults(annotationData);
    imageAnnotation();
    annotationControl();
}

/**
 * Register full screen events
 * Doesn't work with Tobii embeded browser
 */
function initFullScreenEvents() {
    $("#full-screen")
        .unbind("click")
        .click(function () {});
    $("#full-screen").click(async function () {
        let val = $(this).attr("isFullScreen");
        val = parseInt(val);
        // already full screen
        if (val) {
            exitFullscreen();
            $("#full-screen").text("Full Screen");
            $(this).attr("isFullScreen", 0);
        } else {
            // not full screen now
            openFullscreen(document.documentElement);
            $("#full-screen").text("Exit Full Screen");
            $(this).attr("isFullScreen", 1);
        }
    });
}

/**
 * Register the socket io for the eyetracker
 */
function registerSocketIO() {
    socket = io();
    socket.on("connect", function () {
        socket.emit("my_event", { data: "I'm connected!" });
    });

    socket.on("gazepos", function (msg, cb) {
        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        msg = msg.gazepos;

        currentConfig["LGazePos"] = [parseFloat(msg[0]).toFixed(3), parseFloat(msg[1]).toFixed(3)];
        currentConfig["RGazePos"] = [parseFloat(msg[2]).toFixed(3), parseFloat(msg[3]).toFixed(3)];
        currentConfig["eventLog"] = msg[4]; //store the system timestamp
        currentConfig["eventType"] = "eye_tracker";
        currentConfig["eventTarget"] = "OSDViewer";
        let leftEye = new OpenSeadragon.Point(
            parseFloat(Math.round(parseFloat(msg[0]) * screenWidth) - marginLeft),
            parseFloat(Math.round(parseFloat(msg[1]) * screenHeight) - marginTop)
        );
        let rightEye = new OpenSeadragon.Point(
            parseFloat(Math.round(parseFloat(msg[2]) * screenWidth) - marginLeft),
            parseFloat(Math.round(parseFloat(msg[3]) * screenHeight) - marginTop)
        );
        //console.log(leftEye);
        //console.log(OSDviewer.viewport.pointFromPixel(leftEye));
        let LGazePosImg = imageCoordinatesFromPixel(leftEye);
        let RGazePosImg = imageCoordinatesFromPixel(rightEye);
        //console.log(LGazePosImg);
		currentConfig["LGazePosImg"] = [parseFloat(LGazePosImg[0]).toFixed(3), parseFloat(LGazePosImg[1]).toFixed(3)];
        currentConfig["RGazePosImg"] = [parseFloat(RGazePosImg[0]).toFixed(3), parseFloat(RGazePosImg[1]).toFixed(3)];
        //console.log(currentConfig["RGazePos"], RGazePosImg);
        currentEyeTrackerData["LGazePos"] = currentConfig["LGazePos"];
        currentEyeTrackerData["RGazePos"] = currentConfig["RGazePos"];
        currentEyeTrackerData["LGazePosImg"] = currentConfig["LGazePosImg"];
        currentEyeTrackerData["RGazePosImg"] = currentConfig["RGazePosImg"];
        currentEyeTrackerData["timestamp"] = msg[4];
        //trackerData.push(currentConfig);
    });

    socket.on("eyepos", function (msg, cb) {
        // The following code check the fps of eye-tracker
        // eyetrackerCount += 1;
        // if(eyetrackerCount % 120 == 1){

        //     if(eyetrackerCount != 1){
        //         console.log(performance.now() - debugTime);
        //     }
        //     debugTime = performance.now();
        // }
        msg = msg.eyepos;
        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["LEyePos"] = [parseFloat(msg[0]).toFixed(3), parseFloat(msg[1]).toFixed(3), parseFloat(msg[2]).toFixed(3)];
        currentConfig["REyePos"] = [parseFloat(msg[3]).toFixed(3), parseFloat(msg[4]).toFixed(3), parseFloat(msg[5]).toFixed(3)];
        currentConfig["LGazePos"] = currentEyeTrackerData["LGazePos"];
        currentConfig["RGazePos"] = currentEyeTrackerData["RGazePos"];
        currentConfig["LGazePosImg"] = currentEyeTrackerData["LGazePosImg"];
        currentConfig["RGazePosImg"] = currentEyeTrackerData["RGazePosImg"];
        currentConfig["eventLog"] = currentEyeTrackerData["timestamp"];
        currentConfig["eventType"] = "eye_tracker";
        currentConfig["eventTarget"] = "OSDViewer";

        currentEyeTrackerData["LEyePos"] = [parseFloat(msg[0]).toFixed(3), parseFloat(msg[1]).toFixed(3), parseFloat(msg[2]).toFixed(3)];
        currentEyeTrackerData["REyePos"] = [parseFloat(msg[3]).toFixed(3), parseFloat(msg[4]).toFixed(3), parseFloat(msg[5]).toFixed(3)];

        //console.log(currentConfig["LEyePos"], currentConfig["REyePos"]);
        trackerData.push(currentConfig);
    });
}

function debugEyeTracker() {
    console.log(currentEyeTrackerData.LGazePos);
    console.log(currentEyeTrackerData.RGazePos);
    let leftEye = new OpenSeadragon.Point(
        Math.round(currentEyeTrackerData.LGazePos[0] * screenWidth) -
            marginLeft,
        Math.round(currentEyeTrackerData.LGazePos[1] * screenHeight) - marginTop
    );
    console.log(leftEye.x, leftEye.y);
}

/**
 * If the annotorious is used, init the color css
 */
function initFormatter() {
    let colorDic = {};
    Object.keys(labelDict).forEach((d, i) => {
        if (
            labelDict[d].label_type == 4 ||
            labelDict[d].label_type == 5 ||
            labelDict[d].label_type == 10 ||
            labelDict[d].label_type == 6
        ) {
            colorDic[d] = labelDict[d].label_color;
            localizationLabels[d] = labelDict[d].label_name;
        }
    });
    var sheet = window.document.styleSheets[2];
    Object.keys(colorDic).forEach((d, i) => {
        let style = `
                .a9s-annotationlayer .a9s-annotation.${d} .a9s-inner {
                    stroke:${colorDic[d]} !important;
                }
            `;
        sheet.insertRule(style, sheet.cssRules.length);
        let highlightStyle = `
                .a9s-annotationlayer .a9s-annotation.GREEN.editable.selected .a9s-inner,
                .a9s-annotationlayer .a9s-annotation.${d}:hover .a9s-inner  {
                    stroke:${colorDic[d] + "CC"} !important;
                }
            `;
        sheet.insertRule(highlightStyle, sheet.cssRules.length);
        let selectedStyle = `
                .a9s-annotationlayer .a9s-annotation .${d} .a9s-inner  {
                    stroke:${colorDic[d]} !important;
                }
            `;
        sheet.insertRule(selectedStyle, sheet.cssRules.length);
        let labelStyle = `
                .div-${d} {
                    border-color: ${colorDic[d]} !important;
                    background-color: ${colorDic[d]} !important;
                }
            `;
        sheet.insertRule(labelStyle, sheet.cssRules.length);
    });
}

/**
 * init widgets
 */
function initWidgets(data) {
    $("#discuss-btn").tooltip();
    $("#bookmark-btn").tooltip();
    $("#caption-btn").tooltip();
    $("#paper-btn").tooltip();

    //discuss button
    if (parseInt(data["need_discuss"]) == 1) {
        $("#discuss-btn").attr("src", "../static/images/icons/discuss-1.png");
        $("#discuss-btn").attr("isDiscuss", 1);
    } else {
        $("#discuss-btn").attr("src", "../static/images/icons/discuss-0.png");
        $("#discuss-btn").attr("isDiscuss", 0);
    }

    $("#discuss-btn")
        .unbind("click")
        .click(function () {});
    $("#discuss-btn").click(async function () {
        if ($(this).attr("isDiscuss") == 1) {
            await updateLabelAll(username, image_id, "need_discuss", 0, "int");
            $("#discuss-btn").attr(
                "src",
                "../static/images/icons/discuss-0.png"
            );
            $("#discuss-btn").attr("isDiscuss", 0);
        } else if ($(this).attr("isDiscuss") == 0) {
            await updateLabelAll(username, image_id, "need_discuss", 1, "int");
            $("#discuss-btn").attr(
                "src",
                "../static/images/icons/discuss-1.png"
            );
            $("#discuss-btn").attr("isDiscuss", 1);
        }
    });

    //mark as fun button
    if (parseInt(data["marked_fun"]) == 1) {
        $("#fun-btn").attr("src", "../static/images/icons/fun-1.png");
        $("#fun-btn").attr("isFun", 1);
    } else {
        $("#fun-btn").attr("src", "../static/images/icons/fun-0.png");
        $("#fun-btn").attr("isFun", 0);
    }

    $("#fun-btn")
        .unbind("click")
        .click(function () {});
    $("#fun-btn").click(async function () {
        if ($(this).attr("isFun") == 1) {
            await updateLabelAll(username, image_id, "marked_fun", 0, "int");
            $("#fun-btn").attr("src", "../static/images/icons/fun-0.png");
            $("#fun-btn").attr("isFun", 0);
        } else if ($(this).attr("isFun") == 0) {
            await updateLabelAll(username, image_id, "marked_fun", 1, "int");
            $("#fun-btn").attr("src", "../static/images/icons/fun-1.png");
            $("#fun-btn").attr("isFun", 1);
        }
    });

    // Check caption
    // Check if the caption is provided
    if (data["caption_url"] === null) {
        $("#caption-btn").css("display", "none");
    }

    $("#caption-btn").attr("ifClicked", 0);
    $("#caption-btn").attr("src", "../static/images/icons/caption-0.png");
    $(".caption-tooltip").remove();
    if (parseInt(data["checked_caption"]) == 1) {
        $("#caption-btn").attr("src", "../static/images/icons/caption-1.png");
    }
    $("#caption-btn")
        .unbind("click")
        .click(function () {});
    $("#caption-btn").click(async function () {
        //show tooltip
        if (parseInt($(this).attr("ifClicked")) == 0) {
            $(this).attr("ifClicked", 1);
            let captionText = data["caption_url"];
            console.log(captionText);
            $("#caption-btn").next(".caption-tooltip").remove();
            if (captionText !== null) {
                var img = await getFigureMeta(captionText);
                var width = img.width;
                var height = img.height;
            }
            //$(this).after('<span class="caption-tooltip">' + captionText + '</span>');
            $(this).after(function () {
                if (captionText !== null) {
                    //console.log(width, height);
                    let max_width = width / 2.5;
                    let capHTML = `<img class="caption-tooltip" style="max-width: ${max_width}px;" src="${captionText}">`;
                    return capHTML;
                } else {
                    let capHTML = `<span class="caption-tooltip">No caption associated with this figure</span>`;
                    return capHTML;
                }
            });
            if (captionText !== null) {
                var left = $(this).position().left - width / 5;
            } else {
                var left = $(this).position().left + $(this).width() - 150;
            }

            var top = $(this).position().top + 20;
            $(this).next().css("left", left);
            $(this).next().css("top", top);
            await updateLabelAll(
                username,
                image_id,
                "checked_caption",
                1,
                "int"
            );
            $(this).attr("src", "../static/images/icons/caption-1.png");
        } else {
            $(this).attr("ifClicked", 0);
            $(".caption-tooltip").remove();
        }
    });

    $("#caption-btn").tooltip({
        trigger: "hover",
        placement: "top",
    });

    //check the paper
    if (data["paper_url"] === null) {
        $("#paper-btn").css("display", "none");
    }
    $("#paper-btn").attr("src", "../static/images/icons/paper-link-0.png");
    if (parseInt(data["checked_paper"]) == 1) {
        $("#paper-btn").attr("src", "../static/images/icons/paper-link-1.png");
    }
    $("#paper-btn")
        .unbind("click")
        .click(function () {});
    $("#paper-btn").click(async function () {
        window.open(data["paper_url"], "_blank");
        await updateLabelAll(username, image_id, "checked_paper", 1, "int");
        $(this).attr("src", "../static/images/icons/paper-link-1.png");
    });

    //is error
    if (data["is_error_image"] == 1) {
        $("#error-btn").prop("checked", true);
    } else {
        $("#error-btn").prop("checked", false);
    }
    $("#error-btn")
        .unbind("click")
        .click(function () {});
    $("#error-btn").click(async function () {
        if ($(this).prop("checked") == true) {
            await updateLabel(username, image_id, "is_error_image", 1, "int");
        } else if ($(this).prop("checked") == false) {
            await updateLabel(username, image_id, "is_error_image", 0, "int");
        }
    });
}

/**
 * init the image
 * @param {*} data
 */
function initImage(data) {
    trackerData = [];
    let imageUrl = data["image_url"];
    let imageExtension = imageUrl.split(".").pop();
    if (imageExtension === "dzi") {
        $("#pause-eyetracker").text("Pause");
        $("#pause-eyetracker").attr("isPause", 0);
        isDeepZoomImage = true;
        $("#vis-img").css("display", "none");
        OSDviewer = OpenSeadragon({
            id: "img-box",
            prefixUrl: "../static/libs/annotorious/images/",
            tileSources: imageUrl,
            maxZoomPixelRatio: 1,
            minZoomImageRatio: 1,
            visibilityRatio: 1,
            zoomPerScroll: 1.5,
            constrainDuringPan: true,
            animationTime: 0.1,
            blendTime: 0,
            showNavigationControl: false,
            showNavigator: true,
            // debugMode:  true,
        });
        $(OSDviewer.element)
            .find(".navigator")
            .css("background-color", "transparent");
        OSDviewer.gestureSettingsMouse.clickToZoom = false; //disable the clicking zoom event
        if (trackerEnabled) {
            registerOSDTrackerEvents();
        }

        // initialize the Annotorious
        anno = null;
        anno = OpenSeadragon.Annotorious(OSDviewer, {
            locale: "auto",
            allowEmpty: true,
            //gigapixelMode: true,
            disableEditor: false,
            widgets: [tagSelectorWidget],
            formatters: [LabelFormatter, ClassColorFormatter],
        });
        Annotorious.SelectorPack(anno);
        registerAnnotoriousEvents();
    } else {
        // $('#vis-img').attr("src", data['image_url']);
        // //magnify image
        // $('#BlowupLens').remove();
        // $("#vis-img").blowup({
        //     "round": false,
        //     "border": "3px solid #636e72",
        //     "scale": 4,
        //     "width": 350,
        //     "height": 350,
        //     "background": '#fff'
        // });
        // $(window).resize(function () {
        //     $('#BlowupLens').remove();
        //     $("#vis-img").blowup({
        //         "round": false,
        //         "border": "3px solid #636e72",
        //         "scale": 4,
        //         "width": 350,
        //         "height": 350,
        //         "background": '#fff'
        //     });
        // });
    }
}

/**
 * when the animation happend
 */
var updateFrame = function () {
    currentConfig["boundX"] = OSDviewer.viewport
        .getBoundsNoRotate()
        .getTopLeft().x;
    currentConfig["boundY"] = OSDviewer.viewport
        .getBoundsNoRotate()
        .getTopLeft().y;
    currentConfig["boundW"] = (OSDviewer.viewport.getBoundsNoRotate().width).toFixed(3);
    currentConfig["boundH"] = (OSDviewer.viewport.getBoundsNoRotate().height).toFixed(3);
};

/**
 * get the current time in the DD-HH.MM.SS.FFF format.
 */
function getCurrentTimeStamp() {
    let currentDate = new Date();
    return `${currentDate.getFullYear()}-${currentDate.getMonth()+1}-${currentDate.getDate()}-${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}.${currentDate.getMilliseconds()}`;
}

function getOSDViewerParams(config) {
    config["containerW"] = OSDviewer.viewport._containerInnerSize.x;
    config["containerH"] = OSDviewer.viewport._containerInnerSize.y;
    config["boundW"] = (OSDviewer.viewport.getBoundsNoRotate().width).toFixed(3);
    config["boundH"] = (OSDviewer.viewport.getBoundsNoRotate().height).toFixed(3);
    config["boundX"] = (OSDviewer.viewport.getBoundsNoRotate().getTopLeft().x).toFixed(3);
    config["boundY"] = (OSDviewer.viewport.getBoundsNoRotate().getTopLeft().y).toFixed(3);

    let zoom = OSDviewer.viewport.getZoom();
    config["imageZoom"] = parseFloat(OSDviewer.viewport.viewportToImageZoom(zoom)).toFixed(4);
    if (config["imgAsp"] > 1) {
        zoom = zoomRatio * zoom;
    }
    //console.log(zoom);
    config["zoom"] = parseFloat(zoom).toFixed(3);
    config["FPS"] = FPS;
    config["timestamp"] = getCurrentTimeStamp();

    // store eye-tracker data for all events
    if (
        currentEyeTrackerData["LGazePos"].length != 0 &&
        currentEyeTrackerData["LGazePosImg"].length != 0
    ) {
        config["LGazePos"] = currentEyeTrackerData["LGazePos"];
        config["RGazePos"] = currentEyeTrackerData["RGazePos"];
        config["LGazePosImg"] = currentEyeTrackerData["LGazePosImg"];
        config["RGazePosImg"] = currentEyeTrackerData["RGazePosImg"];
        config["LEyePos"] = currentEyeTrackerData["LEyePos"];
        config["REyePos"] = currentEyeTrackerData["REyePos"];
    }

    return config;
}

/**
 * DEBUG: output the navigator coordinates
 */
function debugNavigatorBounds() {
    let containerSize = OSDviewer.viewport._containerInnerSize;
    let OSDViewerAsp = containerSize.y / containerSize.x;
    let imageAsp =
        OSDviewer.world.getItemAt(0).source.dimensions.y /
        OSDviewer.world.getItemAt(0).source.dimensions.x;
    console.log(
        `image size- width : ${
            OSDviewer.world.getItemAt(0).source.dimensions.x
        }, height : ${OSDviewer.world.getItemAt(0).source.dimensions.y}`
    );
    console.log(`image aspect ratio : ${imageAsp}`);
    console.log(
        `OSDViewer size- width : ${OSDviewer.viewport._containerInnerSize.x}, height : ${OSDviewer.viewport._containerInnerSize.y}`
    );
    console.log(`OSDViewer aspect ratio : ${OSDViewerAsp}`);
    // Wide image
    if (imageAsp <= 1) {
        console.log(
            `Navigation panel bound- width : ${1}, height : ${1 * OSDViewerAsp}`
        );
        let visiAreaBound = OSDviewer.viewport.getBoundsNoRotate();
        console.log(`Visible area bound- width : ${visiAreaBound.width}, height : ${visiAreaBound.height}, 
        x : ${visiAreaBound.x}, y : ${visiAreaBound.y}`);
        console.log(`Image bound- width : ${1}, height : ${1 * imageAsp}`);
    } else {
        let OSDViewerH = 1 * imageAsp;
        console.log(
            `Navigation panel bound- width : ${
                OSDViewerH / OSDViewerAsp
            }, height : ${OSDViewerH}`
        );
        let visiAreaBound = OSDviewer.viewport.getBoundsNoRotate();
        console.log(`Visible area bound- width : ${visiAreaBound.width}, height : ${visiAreaBound.height}, 
        x : ${visiAreaBound.x}, y : ${visiAreaBound.y}`);
        console.log(`Image bound- width : ${1}, height : ${1 * imageAsp}`);
    }
}

/**
 * Given a position on canvas space (screen space - margin)
 */
function imageCoordinatesFromPixel(point) {
    var viewportPoint = OSDviewer.viewport.pointFromPixel(point);
    //console.log(viewportPoint);
    var imagePoint = OSDviewer.world
        .getItemAt(0)
        .viewportToImageCoordinates(viewportPoint);
    //console.log(imagePoint);
    return [imagePoint.x.toFixed(3), imagePoint.y.toFixed(3)];
}

/**
 * Register the eye tracker and mouse tracker events
 */
function registerOSDTrackerEvents() {
    OSDviewer.addHandler("open", function () {
        //initialization
        $("#next").prop("disabled", false);
        $("#exit-btn").prop("disabled", false);
        $("#zoom-label").text(`zoom: 1`);
        let currentConfig = { ...trackerConfig };
        currentConfig["imgW"] =
            OSDviewer.world.getItemAt(0).source.dimensions.x;
        currentConfig["imgH"] =
            OSDviewer.world.getItemAt(0).source.dimensions.y;
        currentConfig["imgAsp"] =
            (OSDviewer.world.getItemAt(0).source.dimensions.y /
            OSDviewer.world.getItemAt(0).source.dimensions.x).toFixed(3);
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "image_loaded";
        currentConfig["eventTarget"] = "OSDViewer";
        trackerData.push(currentConfig);
        trackerConfig = currentConfig;
        if (trackerConfig["imgAsp"] > 1) {
            zoomRatio = trackerConfig["boundW"];
        }
        //console.log(trackerConfig);
        if (eyetrackerEnabled) {
            socket.emit("my_event", { data: "begin_eye_tracking" });
            console.log("begin_eye_tracking!");
        }

        // =================== Listen mouse and key events ================== //
        // mouse enter
        $(".openseadragon-container").mouseenter(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_enter";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("enter OSD", currentConfig);
        });

        $(".navigator").mouseenter(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_enter";
            currentConfig["eventTarget"] = "Navigator";
            currentConfig["eventLog"] = [event.offsetX, event.offsetY];
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            trackerData.push(currentConfig);
            //console.log("enter navigator", currentConfig);
        });

        $(".a9s-inner").mouseenter(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_enter";
            currentConfig["eventTarget"] = "Annotation";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("enter polygon", currentConfig);
        });

        // mouse leave
        $(".openseadragon-container").mouseleave(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_leave";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("leave OSD", currentConfig);
        });

        $(".navigator").mouseleave(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_leave";
            currentConfig["eventTarget"] = "Navigator";
            currentConfig["eventLog"] = [event.offsetX, event.offsetY];
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            trackerData.push(currentConfig);
            //console.log("leave navigator", currentConfig);
        });

        $(".a9s-inner").mouseleave(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_leave";
            currentConfig["eventTarget"] = "Annotation";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("leave polygon", currentConfig);
        });

        // mouse click
        $(".openseadragon-container").click(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_click";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("click OSD", currentConfig);
        });

        $(".navigator").click(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_click";
            currentConfig["eventTarget"] = "Navigator";
            currentConfig["eventLog"] = [event.offsetX, event.offsetY];
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            trackerData.push(currentConfig);
            //console.log("click navigator", currentConfig);
            event.stopPropagation();
        });

        anno.on("clickAnnotation", function (annotation, element) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_click";
            currentConfig["eventTarget"] = "Annotation";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("clicked annotation", currentConfig);
            event.stopPropagation();
        });

        // mouse move
        $(".openseadragon-container").mousemove(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_move";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
            //console.log("move in OSD", currentConfig);
        });

        $(".navigator").mousemove(function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_move";
            currentConfig["eventTarget"] = "Navigator";
            currentConfig["eventLog"] = [event.offsetX, event.offsetY];
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            trackerData.push(currentConfig);
            event.stopPropagation();
        });

        // mouse scroll
        OSDviewer.addHandler("canvas-scroll", function (event) {
            //console.log("scroll", event.scroll);
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_scroll";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.position.x, event.position.y];
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(
                event.position
            );
            currentConfig["eventLog"] = event.scroll;
            trackerData.push(currentConfig);
            console.log("scroll", currentConfig);
            $("#zoom-label").text(`zoom: ${currentConfig["zoom"]}`);
            //DEBUG
            // let width_zoom = OSDviewer.viewport.getZoom();
            // let img_zoom = OSDviewer.viewport.viewportToImageZoom(width_zoom);
            // $('#zoom-long-label').text(`zoom (longest edge): ${currentConfig['zoom'].toFixed(2)}`);
            // $('#zoom-width-label').text(`zoom (width): ${width_zoom.toFixed(2)}`);
            // $('#zoom-img-label').text(`zoom (image): ${img_zoom.toFixed(2)}`);
        });

        // mouse drag
        OSDviewer.addHandler("canvas-drag", function (event) {
            //console.log("drag", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_drag";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.position.x, event.position.y];
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(
                event.position
            );
            trackerData.push(currentConfig);
            //console.log("drag OSD", currentConfig);
        });

        // navigator dragging
        // OSD eats some events, we need to overwrite
        // Check: https://github.com/openseadragon/openseadragon/issues/1352
        // https://codepen.io/iangilman/pen/zPyOQp
        var originalDragHandler = OSDviewer.navigator.innerTracker.dragHandler;
        //var originalDragEndHandler = OSDviewer.navigator.innerTracker.dragEndHandler;
        OSDviewer.navigator.innerTracker.dragHandler = function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_drag";
            currentConfig["eventTarget"] = "Navigator";
            currentConfig["eventLog"] = [event.position.x, event.position.y];
            currentConfig["mousePos"] = [
                event.originalEvent.pageX,
                event.originalEvent.pageY,
            ];
            trackerData.push(currentConfig);
            //console.log("drag navigator", currentConfig);
            originalDragHandler.apply(window, arguments);
        };

        // mouse drag_end
        OSDviewer.addHandler("canvas-drag-end", function (event) {
            //console.log("drag", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_dragend";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["mousePos"] = [event.position.x, event.position.y];
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(
                event.position
            );
            trackerData.push(currentConfig);
            //console.log("drag end OSD", currentConfig);
        });

        OSDviewer.navigator.innerTracker.dragEndHandler = function (event) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "mouse_dragend";
            currentConfig["eventTarget"] = "Navigator";
            currentConfig["eventLog"] = [event.position.x, event.position.y];
            currentConfig["mousePos"] = [
                event.originalEvent.pageX,
                event.originalEvent.pageY,
            ];
            trackerData.push(currentConfig);
            //console.log("drag end navigator", currentConfig);
            //originalDragEndHandler.apply(window, arguments);
        };

        // key press
        OSDviewer.addHandler("canvas-key", function (event) {
            // console.log("key-press", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "key_press";
            currentConfig["eventTarget"] = "OSDViewer";
            currentConfig["eventLog"] = event.originalEvent.code;
            trackerData.push(currentConfig);
            //console.log("key-press", currentConfig);
        });

        // update_frame
        OSDviewer.addHandler("animation", function (event) {
            // console.log("animate", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "update_frame";
            currentConfig["eventTarget"] = "OSDViewer";
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        // start_region_annotation, i.e., adding new points to the canvas
        anno.on("startSelection", function (point) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "start_region_annotation";
            currentConfig["eventTarget"] = "Annotation";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
        });

        // dbclick, end_region_annotation
        $(".openseadragon-container").dblclick(function (event) {
            if (activeRegionType == "polygon") {
                let currentConfig = { ...trackerConfig };
                currentConfig = getOSDViewerParams(currentConfig);
                currentConfig["eventType"] = "finish_region_annotation";
                currentConfig["eventTarget"] = "Annotation";
                currentConfig["mousePos"] = [event.pageX, event.pageY];
                let position = new OpenSeadragon.Point(
                    event.offsetX,
                    event.offsetY
                );
                currentConfig["mousePosImg"] =
                    imageCoordinatesFromPixel(position);
                createAnnotationEvent = currentConfig;
                // trackerData.push(currentConfig);
                // console.log("finish annotation", currentConfig);
            }
        });

        // edit region
        anno.on("changeSelectionTarget", function (target) {
            let currentConfig = { ...trackerConfig };
            currentConfig = getOSDViewerParams(currentConfig);
            currentConfig["eventType"] = "start_editing_region";
            currentConfig["eventTarget"] = "Annotation";
            currentConfig["mousePos"] = [event.pageX, event.pageY];
            let position = new OpenSeadragon.Point(
                event.offsetX,
                event.offsetY
            );
            currentConfig["mousePosImg"] = imageCoordinatesFromPixel(position);
            trackerData.push(currentConfig);
        });
    });
}

/**
 * convert coordinates from web space to viewport space
 */
function viewportFromWeb(webpoints, config) {
    let x = webpoints.x / (config.containerW / config.boundW) + config.boundX;
    let y = webpoints.y / (config.containerW / config.boundW) + config.boundY;
    return { x: x, y: y };
}

/**
 * convert coordinates from viewport space to image space
 * @param {*} viewport
 * @param {*} config
 */
function imageFromViewport(viewport, config) {
    let x = viewport.x * config.imgW;
    let y = (viewport.y / config.imgAsp) * config.imgH;
    return { x: x, y: y };
}

/**
 * initialize the annotation buttons
 * @param {*} data
 */
function initAnnotation(data) {
    //reset style
    removeFeedback();
    resetRegionBtnStyle();
    $('#pandas-alert').css("display", "none");

    // For the medical project customization
    if (image_id.charAt(0) == "C") {
        $("#cancer-type").text("Lymph node metastasis detection");
        // Hide all prostate labels
        prostateCategory.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-hr").css("display", "none");
        });
        prostateLabels.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-label").css("display", "none");
        });
        breastCategory.forEach((d, i) => {
            $("#" + d).css("display", "block");
            $("#" + d + "-hr").css("display", "block");
        });
        breastLabels.forEach((d, i) => {
            // $('#'+d).css('display','inline-block');
            $("#" + d + "-label").css("display", "inline-block");
        });
        showTrainingResults = false;
    } else if (image_id.charAt(0) == "P") {
        // Hide all breast labels
        $("#cancer-type").text("Prostate cancer");
        breastCategory.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-hr").css("display", "none");
        });
        breastLabels.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-label").css("display", "none");
        });
        prostateCategory.forEach((d, i) => {
            $("#" + d).css("display", "block");
            $("#" + d + "-hr").css("display", "block");
        });
        prostateLabels.forEach((d, i) => {
            // $('#'+d).css('display','inline-block');
            $("#" + d + "-label").css("display", "inline-block");
        });
        showTrainingResults = false;
    } else if (image_id.substring(0, 2) == "TC") {
        $("#cancer-type").text("Training: Lymph node metastasis detection");
        prostateCategory.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-hr").css("display", "none");
        });
        prostateLabels.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-label").css("display", "none");
        });
        breastCategory.forEach((d, i) => {
            $("#" + d).css("display", "block");
            $("#" + d + "-hr").css("display", "block");
        });
        breastLabels.forEach((d, i) => {
            // $('#'+d).css('display','inline-block');
            $("#" + d + "-label").css("display", "inline-block");
        });
        showTrainingResults = true;
    } else if (image_id.substring(0, 2) == "TP") {
        // Hide all breast labels
        $("#cancer-type").text("Training: Prostate cancer");
        breastCategory.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-hr").css("display", "none");
        });
        breastLabels.forEach((d, i) => {
            $("#" + d).css("display", "none");
            $("#" + d + "-label").css("display", "none");
        });
        prostateCategory.forEach((d, i) => {
            $("#" + d).css("display", "block");
            $("#" + d + "-hr").css("display", "block");
        });
        prostateLabels.forEach((d, i) => {
            // $('#'+d).css('display','inline-block');
            $("#" + d + "-label").css("display", "inline-block");
        });
        showTrainingResults = true;
    }

    $(".GT-label").css("display", "none");

    //init check
    $(".check-label").each(function () {
        let label_id = this.id;
        if (parseInt(data[label_id]) == 1) {
            $("#" + label_id).prop("checked", true);
        } else {
            $("#" + label_id).prop("checked", false);
        }
    });
    //init radio
    $(".radio-label").each(function () {
        let label_id = this.id;
        let parent_id = $(this).attr("name");
        if (data[parent_id] == label_id) {
            $("#" + label_id).prop("checked", true);
        } else {
            $("#" + label_id).prop("checked", false);
        }
    });
    //init text-label
    $(".text-label").each(function () {
        let label_id = this.id;
        $(this).val(data[label_id]);
    });
    //init region labels
    // console.log(data);
    let regionData = [];
    if (data.regions != "") {
        regionData = JSON.parse(data.regions);
    }
    regionData.forEach((d, i) => {
        anno.addAnnotation(d);
    });
}

/**
 * present the annotation results from db to the interface
 */
function showAnnotationResults(data) {
    if (image_id.charAt(0) == "T") {
        $("#index-label").text(currentIndex + 1 + "/" + numOfTrainImages);
    } else {
        $("#index-label").text(
            `${currentIndex - numOfTrainImages + 1}/${
                imageCount - numOfTrainImages
            }`
        );
    }

    //initWidgets(data);
    initImage(data);
    initAnnotation(data);
    //console.log(showTrainingResults);
    //TODO: The current solution
    // if (showTrainingResults) {
    //     $("#show-results").css("display", "block");
    //     $("#show-results")
    //         .unbind("click")
    //         .click(function () {});
    //     $("#show-results").click(function () {
    //         displayGTResults();
    //     });
    // } else {
    //     $("#show-results").css("display", "none");
    // }
    if (currentIndex == 0) {
        $("#previous").prop("disabled", true);
    } else {
        $("#previous").prop("disabled", false);
    }
    if (currentIndex == imageCount - 1) {
        $("#next").text("done");
    } else {
        if (showTrainingResults) {
            $("#next").text("show results");
        } else {
            $("#next").text("next");
        }
    }
}

/**
 * define the formatter for the label widget
 */
var LabelFormatter = function (annotation) {
    // Find the label body (if any)
    const label = annotation.bodies.find((b) => b.type === "TextualBody");
    const id = annotation.id;
    if (label) {
        // Return an HTML label, wrapped in an SVG foreignObject
        const foreignObject = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "foreignObject"
        );
        foreignObject.innerHTML = `
            <div class="div-${label.value}" xmlns="http://www.w3.org/1999/xhtml" > 
                <span>${label.name}</span>
                
            </div>
            `;
        /**
             * <select name="cars" id="select-${label.labelID}">
                    <option value="volvo">class_1</option>
                    <option value="saab">class_2</option>
                    <option value="opel">class_3</option>
                </select>
                <span>${label.value}&nbsp;|&nbsp;</span>
                <i id=delete-${id} class="remove-icon bi bi-trash3-fill"></i>
            </div>
             */

        return {
            element: foreignObject,
        };
    }
};

/**
 * determine the boundary color the annotation
 * @param {*} annotation
 */
var ClassColorFormatter = function (annotation) {
    var highlightBody = annotation.bodies.find(function (b) {
        return b.purpose == "tagging";
    });

    if (highlightBody) return highlightBody.value;
};

/**
 * The widget for updating labels
 * @param {*} args
 */
var tagSelectorWidget = function (args) {
    // Find the current body
    var currentBody = args.annotation
        ? args.annotation.bodies.find(function (b) {
              return b.purpose == "tagging";
          })
        : null;
    // 2. Keep the value in a variable
    var currentLabel = currentBody ? currentBody.value : null;
    // 3. Callback
    var addTag = function (evt) {
        if (currentBody) {
            args.onUpdateBody(currentBody, {
                type: "TextualBody",
                purpose: "tagging",
                value: evt.target.dataset.tag,
            });
        }
    };
    // console.log(currentLabel);
    // UI
    var container = document.createElement("div");
    container.className = "tagselector-widget";
    let select = document.createElement("select");
    select.className = "form-select form-select-sm tag-selector";
    Object.keys(localizationLabels).forEach((d, i) => {
        let option = document.createElement("option");
        option.text = localizationLabels[d];
        option.value = d;
        select.appendChild(option);
    });
    select.value = currentLabel;
    container.appendChild(select);
    // event
    select.addEventListener("change", async (event) => {
        let val = event.target.value;
        let annotation = anno.getSelected();
        // Option 1: we do the updating operation
        annotation.body = {
            value: val,
            name: labelDict[val].label_name,
            purpose: "tagging",
            type: "TextualBody",
        };
        anno.updateSelected(annotation, true);

        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "click_button";
        currentConfig["eventTarget"] = "HTMLUI";
        currentConfig[
            "eventLog"
        ] = `update_region_type: ${annotation.id} to ${val}`;
        trackerData.push(currentConfig);
        //console.log("UI: update region type", currentConfig);
    });
    return container;
};

/**
 * annotation images
 */
function imageAnnotation() {
    //1. type 1 tag annotation
    $(".check-label").click(async function () {
        let label_id = this.id;
        if ($("#" + label_id).is(":checked")) {
            await updateLabel(username, image_id, label_id, 1, "int");
        } else {
            await updateLabel(username, image_id, label_id, 0, "int");
        }

        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "click_button";
        currentConfig["eventTarget"] = "HTMLUI";
        currentConfig["eventLog"] = `update_class: set ${label_id} to 1`;
        trackerData.push(currentConfig);
        //console.log("UI: update classification results", currentConfig);
    });
    //2. type 2 radio annotation
    $(".radio-label").click(async function () {
        let label_id = this.id;
        let parent_label = $(this).attr("name");
        await updateLabel(username, image_id, parent_label, label_id, "str");

        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "click_button";
        currentConfig["eventTarget"] = "HTMLUI";
        currentConfig[
            "eventLog"
        ] = `update_class: set ${parent_label} to ${label_id}`;
        trackerData.push(currentConfig);
        //console.log("UI: update classification results", currentConfig);
    });
    //3. type 3 text annotation
    $("#savecomment")
        .unbind("click")
        .click(function () {});
    $("#savecomment").click(function () {
        saveTextLabels();
    });
}

/**
 * initialize all events with annotorious
 */
function registerAnnotoriousEvents() {
    //4. type 4 and 5 annotation

    // Create a new shape
    anno.on("createSelection", async function (selection) {
        // console.log("create selection");
        selection.body = {
            value: activeLabel,
            name: labelDict[activeLabel].label_name,
            purpose: "tagging",
            type: "TextualBody",
        };
        //anno.updateSelected(selection, true);
        await anno.updateSelected(selection);
        anno.saveSelected();
        $(".poly-btn").attr(
            "class",
            "btn btn-outline-primary block-label local-btn poly-btn"
        );
        $(".rect-btn").attr(
            "class",
            "btn btn-outline-primary block-label local-btn rect-btn"
        );
        $(".mix-btn").attr(
            "class",
            "btn btn-outline-primary local-btn mix-btn"
        );
    });

    // The create, update, and remove operation of annotations.
    anno.on("createAnnotation", async function (selection) {
        if (createAnnotationEvent != null) {
            //console.log("end region annotation");
            let currentConfig = { ...createAnnotationEvent };
            trackerData.push(currentConfig);
            createAnnotationEvent = null;
        } else {
            if (activeRegionType != "polygon") {
                let currentConfig = { ...trackerConfig };
                currentConfig = getOSDViewerParams(currentConfig);
                currentConfig["eventType"] = "finish_region_annotation";
                currentConfig["eventTarget"] = "Annotation";
                currentConfig["eventLog"] = `create_region: ${selection.id}`;
                trackerData.push(currentConfig);
            }
            
        }
        let currentAnnoRes = JSON.stringify(anno.getAnnotations());
        await updateLabel(username, image_id, "regions", currentAnnoRes, "str");
        // console.log("update?");
    });

    anno.on("updateAnnotation", async function (annotation, previous) {
        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "finish_editing_region";
        currentConfig["eventTarget"] = "Annotation";
        currentConfig["eventLog"] = `update_region: ${annotation.id}`;
        trackerData.push(currentConfig);
        let currentAnnoRes = JSON.stringify(anno.getAnnotations());
        await updateLabel(username, image_id, "regions", currentAnnoRes, "str");
    });

    anno.on("deleteAnnotation", async function (annotation) {
        let currentAnnoRes = JSON.stringify(anno.getAnnotations());
        await updateLabel(username, image_id, "regions", currentAnnoRes, "str");

        let currentConfig = { ...trackerConfig };
        currentConfig = getOSDViewerParams(currentConfig);
        currentConfig["eventType"] = "click_button";
        currentConfig["eventTarget"] = "HTMLUI";
        currentConfig["eventLog"] = `remove_annotation: ${annotation.id}`;
        trackerData.push(currentConfig);
        //console.log("UI: remove annotation");
    });

    /**
     * If we selected one annotation, and perform resize / moving operation, after finishing it.
     * We click another annotation. We need to perform a onSaveAndClose operation.
     */
    // $(".openseadragon-canvas").click(function () {});

    $(".rect-btn").click(function () {
        anno.setDrawingTool("rect");
        anno.setDrawingEnabled(true);
        activeLabel = this.id;
        // console.log(this.className);
        resetRegionBtnStyle();
        $("#" + this.id).attr("class", this.className + " selected-btn");
    });
    $(".poly-btn").click(function () {
        anno.setDrawingTool("polygon");
        anno.setDrawingEnabled(true);
        activeLabel = this.id;
        //console.log(this.className);
        resetRegionBtnStyle();
        $("#" + this.id).attr("class", this.className + " selected-btn");
    });
    $(".mix-btn").click(function () {
        anno.setDrawingTool(activeRegionType);
        anno.setDrawingEnabled(true);
        activeLabel = this.id;
        resetRegionBtnStyle();
        $("#" + this.id).attr("class", this.className + " selected-btn");
    });
    $(".region-toolbar-btn").click(function () {
        activeRegionType = this.id.split("-")[0];
        setActiveRegionTool(this);
        anno.setDrawingTool(activeRegionType);
    });
}

/**
 * reset active region type button to inactive
 */
function clearActiveRegionTool() {
    let currentActive = document
        .getElementById("region-toolbar-div")
        .querySelector(".region-toolbar-btn.active");
    if (currentActive) removeClassEle(currentActive, "active");
}

/**
 * set the clicked btn to active
 * @param {*} btn
 */
function setActiveRegionTool(btn) {
    clearActiveRegionTool();
    addClassEle(btn, "active");
}

/**
 * add class to an element
 * @param {*} el
 * @param {*} className
 */
function addClassEle(el, className) {
    let classNames = new Set(el.getAttribute("class").split(" "));
    classNames.add(className);
    el.setAttribute("class", Array.from(classNames).join(" "));
}

/**
 * remove class from an element
 * @param {*} el
 * @param {*} className
 */
function removeClassEle(el, className) {
    let classNames = el
        .getAttribute("class")
        .split(" ")
        .filter((c) => c !== className);
    el.setAttribute("class", classNames.join(" "));
}

/**
 * reset the style of region annotation buttons
 */
function resetRegionBtnStyle() {
    $(".poly-btn").attr(
        "class",
        "btn btn-outline-primary block-label local-btn poly-btn"
    );
    $(".rect-btn").attr(
        "class",
        "btn btn-outline-primary block-label local-btn rect-btn"
    );
    $(".mix-btn").attr("class", "btn btn-outline-primary local-btn mix-btn");
}

/**
 * Check if the current free text labels are valid
 */
function checkTextValidity() {
    let validateText = true;
    $(".text-label").each(async function () {
        let text = $(this).val();
        if (text.includes(";") || text.includes(":")) {
            validateText = false;
        }
    });
    if (validateText == false) {
        showAlert("The ';' and ':' can't be used in the text!");
    }
    return validateText;
}

/**
 * Save the the current text to the tracker data
 */
function saveTextTracker(label_id, text) {
    let currentConfig = { ...trackerConfig };
    currentConfig = getOSDViewerParams(currentConfig);
    currentConfig["eventType"] = "update_text";
    currentConfig["eventTarget"] = "HTMLUI";
    currentConfig["eventLog"] = `update_text: set ${label_id} to ${text}`;
    trackerData.push(currentConfig);
}

/**
 * check whether there is at least one label been labeled in one category
 */
function checkCategory(categ) {
    let status = false;
    document.getElementsByName(categ).forEach((d, i) => {
        let label_id = d.id;
        let className = d.className;
        if (
            className.includes("check-label") ||
            className.includes("radio-label")
        ) {
            if ($("#" + label_id).is(":checked")) {
                status = true;
            }
        } else if (className.includes("text-label")) {
            if ($("#" + label_id).val() != "") {
                status = true;
            }
        }
    });
    //console.log(categ);
    if (image_id.charAt(0) == "C" || image_id.substring(0, 2) == "TC") {
        if (prostateCategory.includes(categ)) {
            status = true;
        }
    } else if (image_id.charAt(0) == "P" || image_id.substring(0, 2) == "TP") {
        if (breastCategory.includes(categ)) {
            status = true;
        }
    }
    // console.log(categ);
    // console.log(status);
    return status;
}

/**
 * present the alert information
 * @param {*} msg
 */
async function showAlert(msg) {
    $("#error-alert-text").text(msg);
    $("#error-alert").css({ display: "block" });
    await sleep(3000);
    $("#error-alert").css({ display: "none" });
}

function removeAlert(msg) {
    $("#error-alert").css({ display: "none" });
}

/**
 * check
 * 1. find all category names
 * 2. for each category, check accomplishment status
 */
function checkAnnotation() {
    if ($("#error-btn").prop("checked")) {
        return true;
    }
    let validateAnnotation = true;
    let categories = [];
    let categoryDic = {};

    // hard coded for prostate images
    if (image_id.charAt(0) == "P" || image_id.substring(0, 2) == "TP") {
        if ($("#lab_21").is(":checked") || $("#lab_22").is(":checked")) {
            if ($("#lab_18").val() != "") {
                return true;
            }
            else{
                showAlert(
                    `Please fill in your decision notes.`
                );
                return;
            }
        }
    }

    Object.keys(labelDict).forEach((label_id) => {
        let label_name = labelDict[label_id]["label_name"];
        if (labelDict[label_id]["label_isrequired"] == 1) {
            categoryDic[label_id] = label_name;
            categories.push(label_id);
        }
    });
    for (let i = 0; i < categories.length; i++) {
        let status = checkCategory(categories[i]);
        if (status == false) {
            validateAnnotation = false;
            if(categoryDic[categories[i]] == 'Decision notes'){
                showAlert(
                    `Please fill in your decision notes.`
                );
            }else{
                showAlert(
                    `Please select at least one option in "${
                        categoryDic[categories[i]]
                    }"`
                );
            }
            break;
        }
    }

    // HARD-CODED: If the diagonosis (lab_5) was selected as not lab_9, there should be at least one polygon
    if (image_id.charAt(0) == "C" || image_id.substring(0, 2) == "TC") {
        let tumorList = ["lab_6", "lab_7", "lab_8"];
        for (let i = 0; i < tumorList.length; i++) {
            if ($("#" + tumorList[i]).is(":checked")) {
                if (!checkTumorRegion()) {
                    showAlert(
                        `Please mark at least one tumor area on the image."`
                    );
                    validateAnnotation = false;
                    break;
                }
            }
        }
    }
    if (image_id.charAt(0) == "P" || image_id.substring(0, 2) == "TP") {
        let tumorList = ["lab_23"];
        for (let i = 0; i < tumorList.length; i++) {
            if ($("#" + tumorList[i]).is(":checked")) {
                if (!checkTumorRegion()) {
                    showAlert(
                        `Please mark at least one tumor area on the image."`
                    );
                    validateAnnotation = false;
                    break;
                }
            }
        }
    }

    if (validateAnnotation) {
        removeAlert();
    }
    return validateAnnotation;
}

/**
 * check if there is at least one tumor region on the current interface
 */
function checkTumorRegion() {
    let exist = false;
    let annotations = anno.getAnnotations();
    annotations.forEach((record, i) => {
        if (record["body"][0] != undefined) {
            if (record["body"][0]["value"] == "lab_2") {
                exist = true;
            }
        }
        else{
            if (record["body"]["value"] == "lab_2") {
                exist = true;
            }
        }
    });
    return exist;
}

/**
 * full screen
 * @param {*} elem
 */
function openFullscreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        /* IE11 */
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullscreen) {
        elem.mozRequestFullScreen();
    }
}

/**
 * full screen
 * @param {*} elem
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        /* Safari */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        /* IE11 */
        document.msExitFullscreen();
    } else if (document.mozExitFullscreen) {
        document.mozExitFullscreen();
    }
}

/**
 * set up the previous and next actions
 */
function annotationControl() {
    $("#pause-eyetracker")
        .unbind("click")
        .click(function () {});
    $("#pause-eyetracker").click(async function () {
        let val = $(this).attr("isPause");
        val = parseInt(val);
        // resume
        if (val) {
            socket.emit("my_event", { data: "begin_eye_tracking" });
            console.log("begin_eye_tracking!");
            $("#pause-eyetracker").text("Pause");
            $(this).attr("isPause", 0);
        } else {
            // pause
            socket.emit("my_event", { data: "end_eye_tracking" });
            console.log("end_eye_tracking");
            $("#pause-eyetracker").text("Resume");
            $(this).attr("isPause", 1);
        }
    });

    $("#previous")
        .unbind("click")
        .click(function () {});
    $("#previous").click(async function () {
        if (currentIndex > 0) {
            // TODO: add disable button function
            //update other tags and design caveats
            saveTextLabels();
            await sleep(500);
            //update user's index and image_id
            let previousIndex = parseInt(currentIndex) - 1;
            let previousImageID = assignment[previousIndex];
            switchFigure(previousImageID, previousIndex);
        }
    });

    $("#next")
        .unbind("click")
        .click(function () {});
    $("#next").click(async function () {
        if (currentIndex < parseInt(imageCount - 1)) {
            if (checkAnnotation() && checkTextValidity()) {
                if (showTrainingResults == true) {
                    showTrainingResults = false;
                    displayGTResults();
                    $("#next").text("next");
                } else {
                    $(this).prop("disabled", true);

                    //get the navigator information
                    var navT = parseInt($(OSDviewer.element).find(".navigator").offset().top);
                    var navL = parseInt($(OSDviewer.element).find(".navigator").offset().left);
                    var navW = parseInt($(OSDviewer.element).find(".navigator").width());
                    var navH = parseInt($(OSDviewer.element).find(".navigator").height());
                    var navMeta = navT + '; ' + navL + '; ' + navW + '; ' + navH;
                    // console.log(navMeta);
                    updateImageNavigatorMeta(image_id, navMeta);

                    let textLabelCount = $(".text-label").length;
                    for (let i = 0; i < textLabelCount; i++) {
                        let label_id = $(".text-label")[i].id;
                        let text = $("#" + label_id).val();
                        await updateLabel(
                            username,
                            image_id,
                            label_id,
                            text,
                            "str"
                        );
                        saveTextTracker(label_id, text);
                    }
                    showFeedback();
                    await sleep(500);
                    removeFeedback();

                    let nextIndex = parseInt(currentIndex) + 1;
                    let nextImageID = assignment[nextIndex];
                    //only update when the current coding index is larger than currentIndex in the database
                    if (nextIndex > dbIndex) {
                        await updateUserProgress(username, nextIndex);
                    }
                    switchFigure(nextImageID, nextIndex);
                }
            }
        } else if (parseInt(currentIndex) == parseInt(imageCount - 1)) {
            if (checkAnnotation() && checkTextValidity()) {
                $(this).prop("disabled", true);
                var navT = parseInt($(OSDviewer.element).find(".navigator").offset().top);
                    var navL = parseInt($(OSDviewer.element).find(".navigator").offset().left);
                    var navW = parseInt($(OSDviewer.element).find(".navigator").width());
                    var navH = parseInt($(OSDviewer.element).find(".navigator").height());
                    var navMeta = navT + '; ' + navL + '; ' + navW + '; ' + navH;
                    // console.log(navMeta);
                    updateImageNavigatorMeta(image_id, navMeta);
                let textLabelCount = $(".text-label").length;
                for (let i = 0; i < textLabelCount; i++) {
                    let label_id = $(".text-label")[i].id;
                    let text = $("#" + label_id).val();
                    await updateLabel(
                        username,
                        image_id,
                        label_id,
                        text,
                        "str"
                    );
                    saveTextTracker(label_id, text);
                }
                showFeedback();
                await sleep(500);
                removeFeedback();

                if (eyetrackerEnabled && trackerEnabled) {
                    socket.emit("my_event", { data: "end_eye_tracking" });
                    console.log("end_eye_tracking");
                }

                let currentConfig = { ...trackerConfig };
                currentConfig = getOSDViewerParams(currentConfig);
                currentConfig["eventType"] = "next_btn_clicked";
                currentConfig["eventTarget"] = "OSDViewer";
                trackerData.push(currentConfig);
                let tracker = JSON.stringify(trackerData);
                await updateTrackerData(username, image_id, tracker);
                console.log("save tracker data");

                // show welcome page
                $("#exit-welcome-text").text("You have completed all WSI reading tasks! Thank you for participating in our study!");
                $("#exit-welcome").css("display", "flex");
                $("#annotate-box").css("display", "none");
                
            }
        }
    });

    $(document).keyup(async function (event) {
        if (event.keyCode == 13) {
            let index_text = $("#image-index-text").val();
            if (index_text != "") {
                if (index_text >= 1 && index_text <= imageCount) {
                    let nextImageID = assignment[index_text - 1];
                    window.location.href =
                        "/annotate_study?image_id=" + nextImageID;
                } else {
                    alert("The figure index is not valid!");
                }
            }
        }
    });
}

/**
 * display the ground truth results of the current image
 * The current version implements the GT using hard-coded approach (store GT to a js)
 */
function displayGTResults() {
    $('#next').prop("disabled", true);
    //add regions
    GT[image_id].region.data.forEach((d, i) => {
        anno.addAnnotation(d);
    });

    //show correct labels
    if (image_id.substring(0, 2) == "TC") {
        let GTLabel = GT[image_id][breastCategory[0]];
        let ifChecked = $("#" + GTLabel).is(":checked");
        $("." + breastCategory[0] + "-radio").each(function (i, d) {
            if ($(d).is(":checked")) {
                let id = d.id;
                $("#" + id + "-GT").css("display", "inline-block");
                if (ifChecked) {
                    $("#" + id + "-GT").text("correct");
                } else {
                    $("#" + id + "-GT").text("incorrect");
                }
            }
        });
        if (ifChecked == false) {
            $("#" + GTLabel + "-GT").css("display", "inline-block");
            $("#" + GTLabel + "-GT").text("correct answer");
        }
    } else if (image_id.substring(0, 2) == "TP") {
        prostateCategory.forEach((category, index) => {
            let GTLabel = GT[image_id][category];
            let ifChecked = $("#" + GTLabel).is(":checked");
            $("." + category + "-radio").each(function (i, d) {
                if ($(d).is(":checked")) {
                    let id = d.id;
                    $("#" + id + "-GT").css("display", "inline-block");
                    if (ifChecked) {
                        $("#" + id + "-GT").text("correct");
                    } else {
                        $("#" + id + "-GT").text("incorrect");
                    }
                }
            });
            if (ifChecked == false) {
                $("#" + GTLabel + "-GT").css("display", "inline-block");
                $("#" + GTLabel + "-GT").text("correct answer");
            }
        });

        //show the warning msg
        $('#pandas-alert').css("display", "block");
    }

    $('#next').prop("disabled", false);
}

/**
 * switch to the new image
 * @param {*} newImageID
 * @param {*} newIndex
 */
async function switchFigure(newImageID, newIndex) {

    if (eyetrackerEnabled && trackerEnabled) {
        socket.emit("my_event", { data: "end_eye_tracking" });
        console.log("end_eye_tracking");
    }

    let currentConfig = { ...trackerConfig };
    currentConfig = getOSDViewerParams(currentConfig);
    currentConfig["eventType"] = "next_btn_clicked";
    currentConfig["eventTarget"] = "OSDViewer";
    trackerData.push(currentConfig);
    let tracker = JSON.stringify(trackerData);

    //await updateLabel(username, image_id, "tracker", tracker, "str");
    await updateTrackerData(username, image_id, tracker);
    console.log("save tracker data");
    $("#next").prop("disabled", false);

    // Check whether this is the last training image and the next one is going to the formal image
    if (image_id.charAt(0) == "T" && newImageID.charAt(0) != "T") {
        $("#formal-welcome").css("display", "flex");
        $("#annotate-box").css("display", "none");
        formalID = newImageID;
        formalIndex = newIndex;
    } else {
        image_id = newImageID;
        currentIndex = newIndex;
        OSDviewer.destroy();
        let info = await getAnnotationInfo(image_id);
        dbIndex = info.current_user_progress;
        annotationData = info["current_annotation_info"][0];
        let log = username + ":" + "login";
        await updateAnnotationLog(username, image_id, log);
        showAnnotationResults(annotationData);
    }
}

/**
 * start the formal annotation
 */
async function startFormal() {
    image_id = formalID;
    currentIndex = formalIndex;
    OSDviewer.destroy();
    let info = await getAnnotationInfo(image_id);
    dbIndex = info.current_user_progress;
    annotationData = info["current_annotation_info"][0];
    let log = username + ":" + "login";
    await updateAnnotationLog(username, image_id, log);
    showAnnotationResults(annotationData);
}

/**
 * show annotation feedback by highlight the button
 */
function showFeedback() {
    $(".btn-check").each(async function () {
        let label_id = this.id;
        if ($("#" + label_id).is(":checked")) {
            $("#" + label_id + "-label").addClass("feedback");
        }
    });
    $(".text-label").each(async function () {
        let label_id = this.id;
        if ($(this).val() != "") {
            $("#" + label_id).addClass("feedback");
        }
    });
}

function removeFeedback() {
    $(".btn-check").each(async function () {
        $("#" + this.id + "-label").removeClass("feedback");
    });
    $(".text-label").each(async function () {
        $("#" + this.id).removeClass("feedback");
    });
}

//})();
