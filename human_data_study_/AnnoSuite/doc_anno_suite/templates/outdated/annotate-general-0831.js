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
var localizationLabels = {}; // For the bbox type switch, all type 4 and type 5 labels

// Event tracker
const trackerEnabled = true;
const eyetrackerEnabled = true;
var trackerData = [];
var trackerConfig = {
    'imgW': 0,
    'imgH': 0,
    'imgAsp': 0,
    'containerW': 0,
    'boundW': 0,
    'boundX': 0,
    'boundY': 0,
    'mousePos': [],
    'mousePosImg': [],
    'LEyePos': [],
    'REyePos': [],
    'LEyePosImg': [],
    'REyePosImg': [],
    'timestamp': '',
    'eventType': '',
    'eventLog': ''
};
var socket;
const screenWidth = 1920;
const screenHeight = 1080;
const marginTop = 100;
const marginLeft = 10;

$(document).ready(async function () {

    /**
     * 1. get information: username
     * 2. get imageID from url address, identify annotation mode
     * 3. get image information
     * 4. present image and annotation info
     * 5. register annotation event
     */
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

        //console.log(info);

        //record the login time
        let log = username + ":" + "login";
        //console.log(username, image_id, log);
        await updateAnnotationLog(username, image_id, log);

        let schemaData = await getLabelSchema();
        labelDict = schemaData["schema"];

        //console.log(labelDict);
        if (eyetrackerEnabled && trackerEnabled) {
            registerSocketIO();
        }

        
        initFullScreenEvents();
        initFormatter();
        showAnnotationResults(annotationData);
        imageAnnotation();
        annotationControl();
    }
});

/**
 * Register full screen events
 */
function initFullScreenEvents(){
    $("#full-screen").unbind("click").click(function () { });
    $("#full-screen").click(async function () {
        let val = $(this).attr('isFullScreen');
        val = parseInt(val);
        // already full screen
        if (val) {
            exitFullscreen();
            $('#full-screen').text('Full Screen');
            $(this).attr("isFullScreen", 0);
        } else {
            // not full screen now
            openFullscreen(document.documentElement);
            $('#full-screen').text('Exit Full Screen');
            $(this).attr("isFullScreen", 1);
        }
    });
}


/**
 * Register the socket io for the eyetracker
 */
function registerSocketIO() {
    socket = io();
    socket.on('connect', function () {
        socket.emit('my_event', { data: 'I\'m connected!' });
    });

    socket.on('eyepos', function (msg, cb) {

        let currentConfig = { ...trackerConfig };
        currentConfig = getTransformationParams(currentConfig);
        msg = msg.eyepos;
        // console.log(msg);
        currentConfig['LEyePos'] = [msg[0], msg[1]];
        currentConfig['REyePos'] = [msg[2], msg[3]];
        currentConfig['eventLog'] = msg[4]; //store the system timestamp
        // currentConfig['LEyeX'] = Math.round(msg[0] * screenWidth);
        // currentConfig['LEyeY'] = Math.round(msg[1] * screenHeight);
        // currentConfig['REyeX'] = Math.round(msg[2] * screenWidth);
        // currentConfig['REyeY'] = Math.round(msg[3] * screenHeight);
        currentConfig['eventType'] = 'eye_tracker';
        let leftEye = new OpenSeadragon.Point(Math.round(msg[0] * screenWidth) - 10, Math.round(msg[1] * screenHeight) - 100);
        let rightEye = new OpenSeadragon.Point(Math.round(msg[2] * screenWidth) - 10, Math.round(msg[3] * screenHeight) - 100);
        currentConfig['LEyePosImg'] = imageCoordinatesFromPixel(leftEye);
        currentConfig['REyePosImg'] = imageCoordinatesFromPixel(rightEye);
        // let imagePoint = OSDviewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);
        //console.log(imagePoint);
        trackerData.push(currentConfig);

    });

}

/**
 * If the annotorious is used, init the color css
 */
function initFormatter() {
    let colorDic = {};
    Object.keys(labelDict).forEach((d, i) => {
        if (labelDict[d].label_type == 4 || labelDict[d].label_type == 5) {
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
        .click(function () { });
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
        .click(function () { });
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
        .click(function () { });
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
        .click(function () { });
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
        .click(function () { });
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
        $('#pause-eyetracker').text('Pause');
        $('#pause-eyetracker').attr("isPause", 0);
        isDeepZoomImage = true;
        $("#vis-img").css("display", "none");
        OSDviewer = OpenSeadragon({
            id: "img-box",
            prefixUrl: "../static/libs/annotorious/images/",
            tileSources: imageUrl,
            maxZoomPixelRatio: 2,
            minZoomImageRatio: 1,
            visibilityRatio: 1,
            // zoomPerScroll: 2,
            constrainDuringPan: true,
            animationTime: 0.1,
            blendTime: 0,
            showNavigationControl: false,
            showNavigator: true,
            // debugMode:  true,
        });
        $(OSDviewer.element).find('.navigator').css('background-color', 'transparent');
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
    currentConfig["boundW"] =
        OSDviewer.viewport.getBoundsNoRotate().width;
    currentConfig["boundH"] =
        OSDviewer.viewport.getBoundsNoRotate().height;
};

/**
 * get the current time in the DD-HH.MM.SS.FFF format.
 */
function getCurrentTimeStamp() {
    let currentDate = new Date();
    return `${currentDate.getDate()}-${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}.${currentDate.getMilliseconds()}`;
}


function getTransformationParams(config) {
    config['containerW'] = OSDviewer.viewport._containerInnerSize.x;
    config['boundW'] = OSDviewer.viewport.getBoundsNoRotate().width;
    config['boundX'] = OSDviewer.viewport.getBoundsNoRotate().getTopLeft().x;
    config['boundY'] = OSDviewer.viewport.getBoundsNoRotate().getTopLeft().y;
    config['timestamp'] = getCurrentTimeStamp();
    return config;
}

/**
 * Given a position on canvas space (screen space - margin)
 */
function imageCoordinatesFromPixel(point) {
    var viewportPoint = OSDviewer.viewport.pointFromPixel(point);
    var imagePoint = OSDviewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);
    return [imagePoint.x, imagePoint.y];
}

/**
 * Register the eye tracker and mouse tracker events
 */
function registerOSDTrackerEvents() {

    OSDviewer.addHandler("open", function () {
        //initialization

        let currentConfig = { ...trackerConfig };
        currentConfig['imgW'] = OSDviewer.world.getItemAt(0).source.dimensions.x;
        currentConfig['imgH'] = OSDviewer.world.getItemAt(0).source.dimensions.y;
        currentConfig['imgAsp'] = OSDviewer.world.getItemAt(0).source.dimensions.y / OSDviewer.world.getItemAt(0).source.dimensions.x;
        currentConfig = getTransformationParams(currentConfig);
        currentConfig['eventType'] = 'image_loaded';
        trackerData.push(currentConfig);
        trackerConfig = currentConfig;

        if (eyetrackerEnabled) {
            socket.emit('my_event', { data: 'begin_eye_tracking' });
            console.log('begin_eye_tracking!');
        }

        // Convertion
        // var webPoint = event.position;
        // var viewportPoint = OSDviewer.viewport.pointFromPixel(webPoint);
        // var imagePoint = OSDviewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);
        // Manual convertion
        // var viewportPoint = viewportFromWeb(webPoint, currentConfig);
        // var test = imageFromViewport(viewportPoint, currentConfig);

        // =================== Listen OSD Viewer mouse and key events ================== //
        OSDviewer.addHandler('canvas-enter', function (event) {
            // console.log("enter", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_enter';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('canvas-exit', function (event) {
            // console.log("exit", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_leave';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        var tracker = new OpenSeadragon.MouseTracker({
            element: OSDviewer.container,
            moveHandler: function (event) {
                // console.log("move", event);
                let currentConfig = { ...trackerConfig };
                currentConfig = getTransformationParams(currentConfig);
                currentConfig['eventType'] = 'mouse_move';
                currentConfig['mousePos'] = [event.position.x, event.position.y];
                currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
                trackerData.push(currentConfig);
                // console.log(currentConfig);
            }
        });
        tracker.setTracking(true);

        OSDviewer.addHandler('canvas-scroll', function (event) {
            // console.log("scroll", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_scroll';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            currentConfig['eventLog'] = event.scroll;
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('canvas-click', function (event) {
            // console.log("click", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_click';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('canvas-double-click', function (event) {
            // console.log("dbclick", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_dbclick';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('canvas-drag', function (event) {
            // console.log("drag", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_drag';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('canvas-drag-end', function (event) {
            // console.log("drag-end", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'mouse_dragend';
            currentConfig['mousePos'] = [event.position.x, event.position.y];
            currentConfig['mousePosImg'] = imageCoordinatesFromPixel(event.position);
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('canvas-key', function (event) {
            // console.log("key-press", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'key_press';
            currentConfig['eventLog'] = event.originalEvent.code;
            trackerData.push(currentConfig);
            // console.log(currentConfig);
        });

        OSDviewer.addHandler('animation', function (event) {
            // console.log("animate", event);
            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'update_frame';
            trackerData.push(currentConfig);
            // console.log(currentConfig);
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
    let scale = 1 / config.boundW;
    let x = viewport.x * config.imgW;
    let y = viewport.y / config.imgAsp * config.imgH;
    return { x: x, y: y };
}

/**
 * initialize the annotation buttons
 * @param {*} data
 */
function initAnnotation(data) {
    //reset style
    removeFeedback();
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
    $("#index-label").text(currentIndex + 1 + "/" + imageCount);
    initWidgets(data);
    initImage(data);
    initAnnotation(data);
    if (currentIndex == 0) {
        $("#previous").prop("disabled", true);
    } else {
        $("#previous").prop("disabled", false);
    }
    if (currentIndex == imageCount - 1) {
        $("#next").text("done");
    } else {
        $("#next").text("next");
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

        // Option 2: leave the saving operation to the ok button
        // args.onUpdateBody(currentBody, {
        //     type: "TextualBody",
        //     purpose: "tagging",
        //     value: val,
        //     name: labelDict[val].label_name,
        // });
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
        currentConfig = getTransformationParams(currentConfig);
        currentConfig['eventType'] = 'click_button';
        currentConfig['eventLog'] = `set ${label_id} to 1`;
        trackerData.push(currentConfig);
    });
    //2. type 2 radio annotation
    $(".radio-label").click(async function () {
        let label_id = this.id;
        let parent_label = $(this).attr("name");
        await updateLabel(username, image_id, parent_label, label_id, "str");

        let currentConfig = { ...trackerConfig };
        currentConfig = getTransformationParams(currentConfig);
        currentConfig['eventType'] = 'click_button';
        currentConfig['eventLog'] = `set ${parent_label} to ${parent_label}`;
        trackerData.push(currentConfig);
    });
    //3. type 3 text annotation
    $("#savecomment")
        .unbind("click")
        .click(function () { });
    $("#savecomment").click(function () {
        saveTextLabels();


    });

    // ONLY FOR TESTING
    // $("#loadGT").click(function () {
    //     tumor_109_gt.data.forEach((d, i) => {
    //         anno.addAnnotation(d); // TODO
    //     });
    // });
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
    });

    // The create, update, and remove operation of annotations.
    anno.on("createAnnotation", async function (selection) {
        let currentAnnoRes = JSON.stringify(anno.getAnnotations());
        await updateLabel(username, image_id, "regions", currentAnnoRes, "str");
        // console.log("update?");
        // console.log("create annotation");
    });

    anno.on("updateAnnotation", async function (annotation, previous) {
        let currentAnnoRes = JSON.stringify(anno.getAnnotations());
        await updateLabel(username, image_id, "regions", currentAnnoRes, "str");
        // console.log("updateAnnotation");
    });

    anno.on("deleteAnnotation", async function (annotation) {
        let currentAnnoRes = JSON.stringify(anno.getAnnotations());
        await updateLabel(username, image_id, "regions", currentAnnoRes, "str");

        // console.log("delete annotation");
    });

    /**
     * If we selected one annotation, and perform resize / moving operation, after finishing it.
     * We click another annotation. We need to perform a onSaveAndClose operation.
     */
    $(".openseadragon-canvas").click(function () { });

    $(".rect-btn").click(function () {
        anno.setDrawingTool("rect");
        anno.setDrawingEnabled(true);
        activeLabel = this.id;
        // console.log(this.className);
        $(".poly-btn").attr(
            "class",
            "btn btn-outline-primary block-label local-btn poly-btn"
        );
        $(".rect-btn").attr(
            "class",
            "btn btn-outline-primary block-label local-btn rect-btn"
        );
        $("#" + this.id).attr("class", this.className + " selected-btn");
    });
    $(".poly-btn").click(function () {
        anno.setDrawingTool("polygon");
        anno.setDrawingEnabled(true);
        activeLabel = this.id;
        console.log(this.className);
        $(".poly-btn").attr(
            "class",
            "btn btn-outline-primary block-label local-btn poly-btn"
        );
        $(".rect-btn").attr(
            "class",
            "btn btn-outline-primary block-label local-btn rect-btn"
        );
        $("#" + this.id).attr("class", this.className + " selected-btn");
    });
}




async function saveTextLabels() {
    let validateText = true;

    $(".text-label").each(async function () {
        let text = $(this).val();
        if (text.includes(";") || text.includes(":")) {
            validateText = false;
        }
    });

    if (validateText) {
        $(".text-label").each(async function () {
            let label_id = this.id;
            let text = $(this).val();
            await updateLabel(username, image_id, label_id, text, "str");
            showFeedback();
            await sleep(500);
            removeFeedback();

            let currentConfig = { ...trackerConfig };
            currentConfig = getTransformationParams(currentConfig);
            currentConfig['eventType'] = 'update_text';
            currentConfig['eventLog'] = `set ${label_id} to ${text}`;
            trackerData.push(currentConfig);

        });
    } else {
        showAlert("The ';' and ':' can't be used in the text!");
    }
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
    // console.log(categ);
    // console.log(status);
    return status;
}

/**
 * present the alert information
 * @param {*} msg
 */
async function showAlert(msg) {
    $("#danger-alert-text").text(msg);
    $("#danger-alert").css({ display: "block" });
    await sleep(3000);
    $("#danger-alert").css({ display: "none" });
}

function removeAlert(msg) {
    $("#danger-alert").css({ display: "none" });
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
            showAlert(
                "Please select at least one " + categoryDic[categories[i]]
            );
            break;
        }
    }

    if (validateAnnotation) {
        removeAlert();
    }
    return validateAnnotation;
}

/**
 * full screen
 * @param {*} elem 
 */
function openFullscreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
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
    } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
    } else if (document.mozExitFullscreen) {
        document.mozExitFullscreen();
    }
}

/**
 * set up the previous and next actions
 */
function annotationControl() {

    

    $("#pause-eyetracker").unbind("click").click(function () { });
    $("#pause-eyetracker").click(async function () {
        let val = $(this).attr('isPause');
        val = parseInt(val);
        // resume
        if (val) {
            socket.emit('my_event', { data: 'begin_eye_tracking' });
            console.log('begin_eye_tracking!');
            $('#pause-eyetracker').text('Pause');
            $(this).attr("isPause", 0);
        } else {
            // pause
            socket.emit('my_event', { data: 'end_eye_tracking' });
            console.log('end_eye_tracking');
            $('#pause-eyetracker').text('Resume');
            $(this).attr("isPause", 1);
        }
    });

    $("#previous").unbind("click").click(function () { });
    $("#previous").click(async function () {
        if (currentIndex > 0) {
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
        .click(function () { });
    $("#next").click(async function () {
        if (currentIndex < parseInt(imageCount - 1)) {
            if (checkAnnotation()) {
                saveTextLabels();
                await sleep(500);
                let nextIndex = parseInt(currentIndex) + 1;
                let nextImageID = assignment[nextIndex];
                //only update when the current coding index is larger than currentIndex in the database
                if (nextIndex > dbIndex) {
                    await updateUserProgress(username, nextIndex);
                }
                switchFigure(nextImageID, nextIndex);
            }
        } else if (parseInt(currentIndex) == parseInt(imageCount - 1)) {
            if (checkAnnotation()) {
                saveTextLabels();
                showFeedback();
                await sleep(500);

                if (eyetrackerEnabled && trackerEnabled) {
                    socket.emit('my_event', { data: 'end_eye_tracking' });
                    console.log('end_eye_tracking');
                }

                let currentConfig = { ...trackerConfig };
                currentConfig = getTransformationParams(currentConfig);
                currentConfig['eventType'] = 'image_end';
                trackerData.push(currentConfig);
                let tracker = JSON.stringify(trackerData);
                //await updateLabel(username, image_id, "tracker", tracker, "str");
                await updateTrackerData(username, image_id, tracker);

                $("#vis-img").css("display", "none");
                $("#AnnoPanel").css("display", "none");
                $("#paper-meta-info").css("display", "none");
                $("#mark-error-box").css("display", "none");
                let htmlText = `<p style="font-size:1.0rem;">
    Contratulations! You have completed all annotation tasks!
    <img style="width:2rem; height:2rem; margin-bottom: 5px" src="../static/images/icecream.png"></p>
    `;
                document.getElementById("img-box").innerHTML = htmlText;
            }
        }
    });

    $(document).keyup(async function (event) {
        if (event.keyCode == 13) {
            let index_text = $("#image-index-text").val();
            if (index_text != "") {
                if (index_text >= 1 && index_text <= imageCount) {
                    let nextImageID = assignment[index_text - 1];
                    window.location.href = "/annotate?image_id=" + nextImageID;
                } else {
                    alert("The figure index is not valid!");
                }
            }
        }
    });
}

/**
 * switch to the new image
 * @param {*} newImageID
 * @param {*} newIndex
 */
async function switchFigure(newImageID, newIndex) {

    if (eyetrackerEnabled && trackerEnabled) {
        socket.emit('my_event', { data: 'end_eye_tracking' });
        console.log('end_eye_tracking');
    }

    let currentConfig = { ...trackerConfig };
    currentConfig = getTransformationParams(currentConfig);
    currentConfig['eventType'] = 'image_end';
    trackerData.push(currentConfig);
    let tracker = JSON.stringify(trackerData);

    //await updateLabel(username, image_id, "tracker", tracker, "str");
    await updateTrackerData(username, image_id, tracker);

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
