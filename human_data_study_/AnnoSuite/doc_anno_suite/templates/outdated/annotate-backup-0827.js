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
var activeLabel = null; // The current selected bounding box (rect, polygon) label
var localizationLabels = {};
var isSelected = false; // If there is any annotation is selected now.
var isAnnotationHovered = [];
var currentAnnotationID = null;
var currentWidget = null;
var lastAnnotationID = -1;
var isUpdated = false; // If the current annotation is updated
var isResized = false;
var ifEntered = 0;

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
        initFormatter();
        showAnnotationResults(annotationData);
        imageAnnotation();
        annotationControl();
    }
});

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
    let imageUrl = data["image_url"];
    let imageExtension = imageUrl.split(".").pop();
    if (imageExtension === "dzi") {
        isDeepZoomImage = true;
        $("#vis-img").css("display", "none");
        OSDviewer = OpenSeadragon({
            id: "img-box",
            prefixUrl: "../static/libs/annotorious/images/",
            tileSources: "../static/medical_images/tumor_109/tumor_109.dzi",
            maxZoomPixelRatio: 2,
            minZoomImageRatio: 1,
            visibilityRatio: 1,
            zoomPerScroll: 2,
            constrainDuringPan: true,
            animationTime: 0.1,
            blendTime: 0,
            showNavigationControl: false,
        });
        OSDviewer.gestureSettingsMouse.clickToZoom = false; //disable the clicking zoom event
        // initialize the Annotorious
        anno = OpenSeadragon.Annotorious(OSDviewer, {
            locale: "auto",
            allowEmpty: true,
            //gigapixelMode: true,
            disableEditor: false,
            widgets: [
                tagSelectorWidget,
                // {
                //     widget: "TAG",
                //     vocabulary: ["Animal", "Building", "Waterbody"],
                // },
            ],
            formatters: [LabelFormatter, ClassColorFormatter],
        });
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
    let regionData = JSON.parse(data.regions);
    // regionData.forEach((d, i) => {
    //     anno.addAnnotation(d);
    // });
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
    currentWidget = args;
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
    });
    //2. type 2 radio annotation
    $(".radio-label").click(async function () {
        let label_id = this.id;
        let parent_label = $(this).attr("name");
        await updateLabel(username, image_id, parent_label, label_id, "str");
    });
    //3. type 3 text annotation
    $("#savecomment")
        .unbind("click")
        .click(function () {});
    $("#savecomment").click(function () {
        saveTextLabels();
    });

    //4. type 4 and 5 annotation
    if (isDeepZoomImage) {
        

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
            
            // isResized = false;
            // anno.setDrawingEnabled(true);
            // add to the database; TODO
        });

        anno.on("createAnnotation", async function (selection) {
            console.log("create annotation");
            let currentAnnoRes = JSON.stringify(anno.getAnnotations());
            await updateLabel(
                username,
                image_id,
                "regions",
                currentAnnoRes,
                "str"
            );
        });

        // anno.on("mouseEnterAnnotation", function (annotation, element) {
        //     console.log("enter");
        //     isAnnotationHovered = [1, annotation.id];
        // });

        // anno.on("mouseLeaveAnnotation", function (annotation, element) {
        //     console.log("leave");
        //     isAnnotationHovered = [0, annotation.id];
        // });

        /**
         * If we selected one annotation, and perform resize / moving operation, after finishing it.
         * We click another annotation. We need to perform a onSaveAndClose operation.
         */
        $(".openseadragon-canvas").click(function () {
            // console.log(lastAnnotationID);
            // if(lastAnnotationID == 0){
            //     currentWidget.onSaveAndClose();
            // }
            // if(lastAnnotationID == -1){
            //     lastAnnotationID++;
            // }
            // currentWidget.onSaveAndClose();
            //anno.updateSelected(annotation, true);
            //console.log(currentAnnotationID == lastAnnotationID);
            // if(currentAnnotationID != lastAnnotationID){
            //     if(lastAnnotationID !== -1 && lastAnnotationID !== null && isSelected === true){
            //         console.log("perform!");
            //     }
            //     lastAnnotationID = currentAnnotationID;
            // }
        });

        // $(".openseadragon-canvas").click(function () {
        //     console.log("canvas-clicked");
        //     // if(currentWidget != null){
        //     //     //currentWidget.onSaveAndClose();
        //     //     console.log(currentWidget);
        //     //     //currentWidget = null;
        //     // }
        //     console.log(isAnnotationHovered);
        //     if (isAnnotationHovered[0]) {
        //         // If we clicked on the annotated area, we should disable the drawing and open the pop-up

        //         if(lastAnnotationID === -1){
        //             // This is the first time to click the annotated area
        //             isSelected = true;
        //             lastAnnotationID = isAnnotationHovered[1];
        //             anno.setDrawingEnabled(false);
        //             anno.selectAnnotation(isAnnotationHovered[1]);
        //         }
        //         else{
        //             isSelected = true;
        //             console.log(lastAnnotationID, isAnnotationHovered[1]);
        //             // If the current annotated area is different from the previous area, we should also remove
        //             // the widget.
        //             if(lastAnnotationID != isAnnotationHovered[1]){
        //                 //currentWidget.onSaveAndClose();
        //                 lastAnnotationID = isAnnotationHovered[1];
        //             }
        //             else{
        //                 anno.setDrawingEnabled(false);
        //                 anno.selectAnnotation(isAnnotationHovered[1]);
        //             }
        //             // anno.setDrawingEnabled(false);
        //             // anno.selectAnnotation(isAnnotationHovered[1]);

        //         }
        //     } else {
        //         // If we clicked on the non-annotated area, and we are currently select something else, close the previous widget.
        //         if(isSelected){
        //             //console.log(currentWidget);
        //             if(isUpdated == false){
        //                 currentWidget.onSaveAndClose();
        //             }
        //             isUpdated = false;
        //             console.log("save");
        //             isSelected = false;
        //             lastAnnotationID = -1;  //since we didn't select anything now.
        //         }
        //     }
        //     //currentWidget.onSaveAndClose();
        // });

        /**
         * The following two events simulate the behavior of VIA
         * i.e., when we click the annotation and perform resize or move operations, the editor should be closed.
         * otherwise, the updating won't happen if we cancel the selection of the current annotation.
         * Reason: in headless mode, the updateAnnotation event will be triggered after canceling the selection
         */
        // anno.on("changeSelectionTarget", function (target) {
        //     anno.disableEditor = true;
        //     isResized = true;
        // });

        /**
         * 
        anno.on("mouseEnterAnnotation", function (annotation, element) {
            console.log("enter");
            isAnnotationHovered = [1, annotation.id];
        });

        anno.on("mouseLeaveAnnotation", function (annotation, element) {
            console.log("leave");
            isAnnotationHovered = [0, annotation.id];
        });
         */

        anno.on("mouseEnterAnnotation", function (annotation, element) {
            //console.log("enter");
            isAnnotationHovered = [1, annotation.id];
            // lastAnnotationID
            ifEntered = 0;
        });

        /**
         * BUG:
         * Test case 1:
         * create two boxes
         * resize one
         * click blank
         * select the other one (first update information, then enter second box) ifEntered = 0
         *
         * Test case 2:
         * create two boxes
         * resize one
         * click the other one  (first enter second box, then update information) ifEntered = 1
         *
         * Q: WHAT is the difference between clicking blank and not?
         */
        anno.on("selectAnnotation", function (annotation, element) {
            //anno.cancelSelected();
            //console.log("selected");
            anno.disableEditor = false;
            currentAnnotationID = annotation.id;
            //console.log(currentAnnotationID);
            /**
             * isResized == true: only happend after resizing or moving
             * currentAnnotationID != lastAnnotationID: this is a different annotation area
             * lastAnnotationID != -1: this is not the initial annotation area
             * ifEntered == 1: only happend when we switch between two annotation area rather than switching between
             * an annotation area and a blank area.
             */
            if (
                isResized == true &&
                currentAnnotationID != lastAnnotationID &&
                lastAnnotationID != -1 &&
                ifEntered == 1
            ) {
                console.log(1);
                //anno.updateSelected(annotation, true);
                //currentWidget.onSaveAndClose();
                anno.cancelSelected();
                //anno.selectAnnotation(currentAnnotationID);
            }
            lastAnnotationID = currentAnnotationID;
            //anno.selectAnnotation(currentAnnotationID);
            isSelected = true;
            isResized = false;
        });

        anno.on("cancelSelected", function (annotation, element) {
            lastAnnotationID = -1;
            console.log("cancel annotation");
            isSelected = false;
            //currentWidget.onSaveAndClose();
        });

        anno.on("updateAnnotation", async function (annotation, previous) {
            //console.log("update annotation");
            // if(anno.getSelected() === undefined){
            //     lastAnnotationID = -1;
            // }

            // TODO: update the database

            let currentAnnoRes = JSON.stringify(anno.getAnnotations());
            await updateLabel(
                username,
                image_id,
                "regions",
                currentAnnoRes,
                "str"
            );
            console.log("updateAnnotation");
            ifEntered = 1;

            // lastAnnotationID = -1;
            // isUpdated = true;
            // isAnnotationHovered[0] = 0;
            // anno.setDrawingEnabled(true);
        });

        anno.on("deleteAnnotation", async function (annotation) {
            let currentAnnoRes = JSON.stringify(anno.getAnnotations());
            await updateLabel(
                username,
                image_id,
                "regions",
                currentAnnoRes,
                "str"
            );
            console.log("delete annotation");
        });

        $(".rect-btn").click(function () {
            anno.setDrawingTool("rect");
            anno.setDrawingEnabled(true);
            activeLabel = this.id;
            $(".local-btn").attr(
                "class",
                this.className.replace("selected-btn", "")
            );
            $("#" + this.id).attr("class", this.className + " selected-btn");
        });
        $(".poly-btn").click(function () {
            anno.setDrawingTool("polygon");
            anno.setDrawingEnabled(true);
            activeLabel = this.id;
            $(".local-btn").attr(
                "class",
                this.className.replace("selected-btn", "")
            );
            $("#" + this.id).attr("class", this.className + " selected-btn");
        });
    }

    $("#loadGT").click(function () {
        tumor_109_gt.data.forEach((d, i) => {
            anno.addAnnotation(d); // TODO
        });
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
 * set up the previous and next actions
 */
function annotationControl() {
    $("#previous")
        .unbind("click")
        .click(function () {});
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
        .click(function () {});
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
    image_id = newImageID;
    currentIndex = newIndex;

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
