

var username;
var image_id;
var annotationData;
var imageCount;
var assignment;
var currentIndex;
var dbIndex; //recent progress in db

var canvas; //used for annotation

var canvasWidth, canvasHeight;
var containerWidth, containerHeight;
var imgWidth, imgHeight;
var imgScale;

var currentLabel;
var bboxIndex = 0;  //index of bounding boxes
var bboxInfo = [];  //store all bboxes
var labelDict;

var useAI = 0; //if AI suggestion is enabled

$(document).ready(async function () {

    /**
     * 1. get information: username
     * 2. get imageID from url address, identify annotation mode
     * 3. get image information
     * 4. present image and annotation info
     * 5. register annotation event
     */
    if (is_ready != 'False') {
        var info;
        if (url_image_id != 'None') { info = await getBBoxAnnotationInfo(url_image_id); }
        else { info = await getBBoxAnnotationInfo(''); }

        annotationData = info['current_annotation_info'][0];
        username = info.current_username;
        image_id = info.current_user_image_id;
        assignment = info.current_user_assignment.split(';')
        currentIndex = assignment.indexOf(image_id);
        dbIndex = info.current_user_progress;
        imageCount = assignment.length;

        labelDict = await getDistictLabelColors();

        //console.log(info);

        //record the login time
        let log = username + ':' + 'login';
        //console.log(username, image_id, log);
        await updateAnnotationLog(username, image_id, log);

        initFabric();
        initLabelColor();
        showAnnotationResults(annotationData);
        imageAnnotation();
        annotationControl();

    }

});

/**
 * initialize the fabric environment
 */
function initFabric() {
    canvas = new fabric.Canvas('img-canvas', {
        preserveObjectStacking: true,
        uniformScaling: false
    });
    fabric.Canvas.prototype.getAbsoluteCoords = function (object) {
        return {
            left: object.left + this._offset.left,
            top: object.top + this._offset.top
        };
    }
    canvas.selectionColor = 'rgba(190, 189, 186, 0.2)';
    $(window).resize(resizeCanvas);

}



/**
 * init widgets
 */
function initWidgets(data) {
    $('#discuss-btn').tooltip();
    $('#bookmark-btn').tooltip();
    $('#caption-btn').tooltip();
    $('#paper-btn').tooltip();

    //discuss button
    if (parseInt(data['need_discuss']) == 1) {
        $("#discuss-btn").attr("src", '../static/images/icons/discuss-1.png');
        $("#discuss-btn").attr("isDiscuss", 1);
    } else {
        $("#discuss-btn").attr("src", '../static/images/icons/discuss-0.png');
        $("#discuss-btn").attr("isDiscuss", 0);
    }

    $('#discuss-btn').unbind('click').click(function () { });
    $("#discuss-btn").click(async function () {
        if ($(this).attr('isDiscuss') == 1) {
            await updateLabelAll(username, image_id, 'need_discuss', 0, 'int');
            $("#discuss-btn").attr("src", '../static/images/icons/discuss-0.png');
            $("#discuss-btn").attr("isDiscuss", 0);
        } else if ($(this).attr('isDiscuss') == 0) {
            await updateLabelAll(username, image_id, 'need_discuss', 1, 'int');
            $("#discuss-btn").attr("src", '../static/images/icons/discuss-1.png');
            $("#discuss-btn").attr("isDiscuss", 1);
        }
    });

    //mark as fun button
    if (parseInt(data['marked_fun']) == 1) {
        $("#fun-btn").attr("src", '../static/images/icons/fun-1.png');
        $("#fun-btn").attr("isFun", 1);
    } else {
        $("#fun-btn").attr("src", '../static/images/icons/fun-0.png');
        $("#fun-btn").attr("isFun", 0);
    }

    $('#fun-btn').unbind('click').click(function () { });
    $("#fun-btn").click(async function () {
        if ($(this).attr('isFun') == 1) {
            await updateLabelAll(username, image_id, 'marked_fun', 0, 'int');
            $("#fun-btn").attr("src", '../static/images/icons/fun-0.png');
            $("#fun-btn").attr("isFun", 0);
        } else if ($(this).attr('isFun') == 0) {
            await updateLabelAll(username, image_id, 'marked_fun', 1, 'int');
            $("#fun-btn").attr("src", '../static/images/icons/fun-1.png');
            $("#fun-btn").attr("isFun", 1);
        }
    });

    //check caption
    $("#caption-btn").attr("ifClicked", 0);
    $("#caption-btn").attr("src", '../static/images/icons/caption-0.png');
    $('.caption-tooltip').remove();
    if (parseInt(data['checked_caption']) == 1) {
        $("#caption-btn").attr("src", '../static/images/icons/caption-1.png');
    }
    $('#caption-btn').unbind('click').click(function () { });
    $('#caption-btn').click(async function () {
        //show tooltip
        if (parseInt($(this).attr("ifClicked")) == 0) {
            $(this).attr("ifClicked", 1);
            let captionText = data['caption_url'];
            console.log(captionText);
            $('#caption-btn').next('.caption-tooltip').remove();
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
            $(this).next().css('left', left);
            $(this).next().css('top', top);
            await updateLabelAll(username, image_id, 'checked_caption', 1, 'int');
            $(this).attr("src", '../static/images/icons/caption-1.png');
        } else {
            $(this).attr("ifClicked", 0);
            $('.caption-tooltip').remove();
        }
    });

    $('#caption-btn').tooltip({
        trigger: 'hover',
        placement: 'top'
    });

    //check the paper
    $("#paper-btn").attr("src", '../static/images/icons/paper-link-0.png');
    if (parseInt(data['checked_paper']) == 1) {
        $("#paper-btn").attr("src", '../static/images/icons/paper-link-1.png');
    }
    $('#paper-btn').unbind('click').click(function () { });
    $("#paper-btn").click(async function () {
        window.open(data['paper_url'], "_blank");
        await updateLabelAll(username, image_id, 'checked_paper', 1, 'int');
        $(this).attr("src", '../static/images/icons/paper-link-1.png');
    });

    //is error
    if (data['is_error_image'] == 1) {
        $("#error-btn").prop("checked", true);
    } else {
        $("#error-btn").prop("checked", false);
    }
    $('#error-btn').unbind('click').click(function () { });
    $("#error-btn").click(async function () {
        if ($(this).prop("checked") == true) {
            await updateLabel(username, image_id, 'is_error_image', 1, 'int');
        } else if ($(this).prop("checked") == false) {
            await updateLabel(username, image_id, 'is_error_image', 0, 'int');
        }
    });


    $('#ai-btn').unbind('click').click(function () { });
    $("#ai-btn").click(async function () {
        if ($(this).prop("checked") == true) {
            useAI = 1;
            let image_url = data['image_url'];
            console.time('AI prediction');
            $('#ai-loading').css("display", 'inline-block');
            let bboxes = await getPredictBox(image_url);
            $('#ai-loading').css("display", 'none');
            console.timeEnd('AI prediction');
            console.log(bboxes);
            displayAIAnnotation(bboxes);

        } else if ($(this).prop("checked") == false) {
            useAI = 0;
            bboxInfo.forEach((d, i) => {
                console.log(d.rectObj.hasChanged);
                if (d.labelType == 'AI' && d.rectObj.hasChanged == 0) {
                    d.isRemove = 1;
                    canvas.remove(d.rectObj);
                    d3.select("#close-"+d.index).remove();
                    d3.select("#labeltext-"+d.index).remove();
                }
                else{
                    d.isRemove = 0;
                }
            });
            bboxInfo = bboxInfo.filter((e)=>{
                return e.isRemove == 0;
            });
            canvas.requestRenderAll();
        }
    });

    if (currentIndex == 0) {
        $('#previous').prop('disabled', true);
    }
    else {
        $('#previous').prop('disabled', false);
    }
    if (currentIndex == imageCount - 1) {
        $("#next").text('done')
    }
    else {
        $("#next").text('next')
    }
}

/**
 * https://stackoverflow.com/questions/21931271/how-to-enable-responsive-design-for-fabric-js
 * create responsive canvas in fabric js
 */
function resizeCanvas() {

    //resize the image
    // let outerCanvasContainer = $('.fabric-canvas-wrapper')[0];

    // let ratio = canvas.getWidth() / canvas.getHeight();
    // let containerWidthNew = outerCanvasContainer.clientWidth;
    // let containerHeight = outerCanvasContainer.clientHeight;

    // let scale = containerWidthNew / containerWidth;
    // containerWidth = containerWidthNew;
    // let zoom = canvas.getZoom() * scale;

    // canvasWidth = canvasWidth * scale;
    // canvasHeight = canvasHeight * scale;
    // canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    // canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);

    //resize the controls
    bboxInfo.forEach((d) => {
        let rect = d['rectObj'];
        let index = d['index'];
        positionCtrls(rect, 'labeltext-' + index);
        positionCtrls(rect, 'close-' + index);
    })


}



/**
 * init the image
 * @param {*} data 
 */
async function initImage(data) {

    //clear all data

    d3.selectAll(".type-div").remove();
    d3.selectAll(".close-div").remove();
    canvas.clear();
    bboxIndex = 0;
    bboxInfo = [];

    containerWidth = document.getElementsByClassName('fabric-canvas-wrapper')[0].clientWidth;
    //containerHeight = document.getElementsByClassName('fabric-canvas-wrapper')[0].clientHeight;
    containerHeight = window.innerHeight - $('.navbar')[0].clientHeight - $('#ctrl-box')[0].clientHeight - 10;
    //console.log("containerHeight", containerHeight);

    let imgUrl = data['image_url'];

    var img = await getFigureMeta(imgUrl);
    imgWidth = img.width;
    imgHeight = img.height;
    //console.log("imgWidth:", imgWidth, "imgHeight:", imgHeight, "containerWidth:", containerWidth, "containerHeight:",containerHeight);

    /**
     * 1. if the current image has a width < containerWidth, set canvas width = imgWidth, image scale = 1
     * 2. if the current image has a width > containerWidth, set canvas width = containerWidth, image scale = imgWidth / containerWidth
     * 3. when resizing the image, image scale = imgWidth / containerWidth * resizeFactor, imageSize = canvas.backgroundImage.lineCoords
     */

    if (imgWidth <= containerWidth) {
        if (imgWidth < imgHeight) {
            //if this is a tall image
            if (imgHeight < containerHeight) {
                imgScale = 1;
            }
            else {
                imgScale = containerHeight / imgHeight;
            }

        }
        else {
            //if this is a wide image
            if (imgHeight > containerHeight) {
                imgScale = containerHeight / imgHeight;
            }
            else {
                imgScale = 1;
            }

        }
    }
    else {
        //if the image is wider than the frame
        if (imgWidth < imgHeight) {
            //if this is a tall image
            if (imgHeight <= containerHeight) {
                imgScale = containerWidth / imgWidth;
            }
            else {
                imgScale = containerHeight / imgHeight;
                if (imgWidth * imgScale > containerWidth) {
                    imgScale = containerWidth / imgWidth;
                }
            }


        }
        else {
            //if this is a wide image
            imgScale = containerWidth / imgWidth;

        }

    }
    canvasWidth = imgWidth * imgScale;
    canvasHeight = imgHeight * imgScale;

    //console.log("canvasWidth", canvasWidth, "canvasHeight", canvasHeight);

    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

    canvas.setBackgroundImage(imgUrl, canvas.renderAll.bind(canvas), {
        top: 0,
        left: 0,
        originX: 'left',
        originY: 'top',
        scaleX: imgScale,
        scaleY: imgScale
    });

    //data['image_url']
    canvas.renderAll();
    displayAnnotation(data);


}

/**
 * initialize the annotation buttons
 * @param {*} data 
 */
 function displayAIAnnotation(data) {
    //retrieve all region information
    //console.log(data);
    let bboxes = null;
    let AIBBoxInfo = [];
    if (data.bbox_info.length != 1) {
        //console.log(bboxes[0]); //check if the bbox value is correct
        data.bbox_info.forEach((d) => {
            bboxIndex += 1;
            AIBBoxInfo.push({
                'L': d['L'],
                'T': d['T'],
                'R': d['R'],
                'B': d['B'],
                'labelID': d['label'],
                'labelType': 'AI',
                'index': bboxIndex
            });
        })
    };

    //create the bounding boxes
    AIBBoxInfo.forEach((d) => {
        let closeID = 'close-' + d['index'];
        let labeltextID = 'labeltext-' + d['index'];
        let rect = new fabric.Rect({
            left: d['L'] * imgScale,
            top: d['T'] * imgScale,
            width: (d['R'] - d['L']) * imgScale,
            height: (d['B'] - d['T']) * imgScale,
            stroke: labelDict[d['labelID']]['color'],
            strokeWidth: 2,
            strokeUniform: true,
            noScaleCache: false,
            fill: 'rgba(0,0,0,0)'
        });
        rect.setControlsVisibility({ mtr: false });
        rect.set({
            transparentCorners: false,
            cornerColor: 'blue',
            cornerStrokeColor: 'red',
            borderColor: 'red',
            cornerSize: 12,
            cornerStyle: 'circle',
            borderDashArray: [3, 3]
        });
        canvas.add(rect);
        rect.hasChanged = 0;
        d['rectObj'] = rect;
        bboxInfo.push(d);
        var absCoords = canvas.getAbsoluteCoords(rect);
        //label indicator span
        var div = d3.select("body").append("div")
            .attr('pointer-events', 'none')
            .attr("id", labeltextID)
            .attr("class", "type-div")
            .style("background-color", labelDict[d['labelID']]['color'])
            .style("left", (absCoords.left + rect.getScaledWidth() - 2) + 'px')
            .style("top", (absCoords.top + rect.getScaledHeight() - 23) + 'px')
            .append("label")
            .attr("class", "type-label-text")
            .attr("id", labeltextID + '-label')
            .html(labelDict[d['labelID']]['label_name']);

        //draw the close label
        var div = d3.select("body").append("div")
            .attr("class", "close-div")
            .attr("id", closeID)
            .style("left", (absCoords.left + (d['R'] - d['L']) * imgScale - 7) + 'px')
            .style("top", (absCoords.top - 10) + 'px')
            .append("img")
            .attr("class", "close-img")
            .attr("id", closeID + '-img')
            .attr("src", "../static/images/icons/close.svg")
            .on("click", function () {
                let removeIndex = this.id.split('-')[1];
                let removeArrayIndex = 0;
                let removeData = null;
                bboxInfo.forEach((d, i) => {
                    if (d['index'] == removeIndex) {
                        removeArrayIndex = i;
                        removeData = d;
                    }
                });
                canvas.remove(removeData['rectObj']);
                canvas.requestRenderAll();
                d3.select('#' + closeID).remove();
                d3.select('#' + labeltextID).remove();
                bboxInfo.splice(removeArrayIndex, 1);
            });

        //control the position of utils
        rect.on('moving', function () {
            positionCtrls(rect, labeltextID);
            positionCtrls(rect, closeID);
        })
        rect.on('rotating', function () {
            positionCtrls(rect, labeltextID);
            positionCtrls(rect, closeID);
        })
        rect.on('scaling', function () {
            positionCtrls(rect, labeltextID);
            positionCtrls(rect, closeID);
        })

    })


}


/**
 * initialize the annotation buttons
 * @param {*} data 
 */
function displayAnnotation(data) {
    //retrieve all region information
    //console.log(data);
    let bboxes = null;

    if (data.regions != "") { bboxes = JSON.parse(data.regions); }
    if (bboxes != null && bboxes != "") {
        //console.log(bboxes[0]); //check if the bbox value is correct
        bboxes.forEach((d) => {
            bboxIndex += 1;
            bboxInfo.push({
                'L': d['L'],
                'T': d['T'],
                'R': d['R'],
                'B': d['B'],
                'labelID': d['label_id'],
                'labelType': d['label_type'],
                'index': bboxIndex
            });
        })
    };

    //create the bounding boxes
    bboxInfo.forEach((d) => {
        let closeID = 'close-' + d['index'];
        let labeltextID = 'labeltext-' + d['index'];
        let rect = new fabric.Rect({
            left: d['L'] * imgScale,
            top: d['T'] * imgScale,
            width: (d['R'] - d['L']) * imgScale,
            height: (d['B'] - d['T']) * imgScale,
            stroke: labelDict[d['labelID']]['color'],
            strokeWidth: 2,
            strokeUniform: true,
            noScaleCache: false,
            fill: 'rgba(0,0,0,0)'
        });
        rect.setControlsVisibility({ mtr: false });
        rect.set({
            transparentCorners: false,
            cornerColor: 'blue',
            cornerStrokeColor: 'red',
            borderColor: 'red',
            cornerSize: 12,
            cornerStyle: 'circle',
            borderDashArray: [3, 3]
        });
        canvas.add(rect);
        rect.hasChanged = 0;
        d['rectObj'] = rect;
        var absCoords = canvas.getAbsoluteCoords(rect);
        //label indicator span
        var div = d3.select("body").append("div")
            .attr('pointer-events', 'none')
            .attr("id", labeltextID)
            .attr("class", "type-div")
            .style("background-color", labelDict[d['labelID']]['color'])
            .style("left", (absCoords.left + rect.getScaledWidth() - 2) + 'px')
            .style("top", (absCoords.top + rect.getScaledHeight() - 23) + 'px')
            .append("label")
            .attr("class", "type-label-text")
            .attr("id", labeltextID + '-label')
            .html(labelDict[d['labelID']]['label_name']);

        //draw the close label
        var div = d3.select("body").append("div")
            .attr("class", "close-div")
            .attr("id", closeID)
            .style("left", (absCoords.left + (d['R'] - d['L']) * imgScale - 7) + 'px')
            .style("top", (absCoords.top - 10) + 'px')
            .append("img")
            .attr("class", "close-img")
            .attr("id", closeID + '-img')
            .attr("src", "../static/images/icons/close.svg")
            .on("click", function () {
                let removeIndex = this.id.split('-')[1];
                let removeArrayIndex = 0;
                let removeData = null;
                bboxInfo.forEach((d, i) => {
                    if (d['index'] == removeIndex) {
                        removeArrayIndex = i;
                        removeData = d;
                    }
                });
                canvas.remove(removeData['rectObj']);
                canvas.requestRenderAll();
                d3.select('#' + closeID).remove();
                d3.select('#' + labeltextID).remove();
                bboxInfo.splice(removeArrayIndex, 1);
            });

        //control the position of utils
        rect.on('moving', function () {
            positionCtrls(rect, labeltextID);
            positionCtrls(rect, closeID);
        })
        rect.on('rotating', function () {
            positionCtrls(rect, labeltextID);
            positionCtrls(rect, closeID);
        })
        rect.on('scaling', function () {
            positionCtrls(rect, labeltextID);
            positionCtrls(rect, closeID);
        })

    })


}



/**
 * present the annotation results from db to the interface
 */
function showAnnotationResults(data) {

    $('#index-label').text((currentIndex + 1) + '/' + imageCount);
    initWidgets(data);
    initDetectionIndicator(data);

    initImage(data);


}

/**
 * synchronize the indicator with the current boundingboxes
 */
function syncIndicator(){
    let annotatedLabel = [];
    bboxInfo.forEach((d)=>{
        if(annotatedLabel.includes(d.labelID) == false){
            annotatedLabel.push(d.labelID);
        }
    });
    Object.keys(labelDict).forEach((d)=>{
        
        if(annotatedLabel.includes(d)){
            $('#'+d+'-indicator').attr("src", '../static/images/icons/bbox-indicator-1.png');
        }
        else{
            $('#'+d+'-indicator').attr("src", '../static/images/icons/bbox-indicator-0.png');
        }
        
    })

}

/**
 * init the indicator to associate the localization with detection task
 * In particular, we show the indicator when:
 * 1. label_type == 1 and value == 1
 * 2. label_type == 2 and value == parent_value
 * 3. label_type == 3? maybe not.
 */
function initDetectionIndicator(data){

    $('.bbox-indicator').attr("src", '../static/images/icons/bbox-indicator-0.png');
    
    Object.keys(labelDict).forEach((d)=>{
        let labelInfo = labelDict[d];
        if(labelInfo.label_type == 1){
            if(data[d] == 1){
                $('#'+d+'-indicator').attr("src", '../static/images/icons/bbox-indicator-1.png');
            }
        }
        else if(labelInfo.label_type == 2){
            if(data[labelInfo.label_parent] == d){
                $('#'+d+'-indicator').attr("src", '../static/images/icons/bbox-indicator-1.png');
            }
        }
    })
}



/**
 * annotate images by free drawing
 * https://stackoverflow.com/questions/9417603/fabric-js-free-draw-a-rectangle
 * the main issue is that we can not get the accurate position of an overlapped bbox, the fabricjs merged two 
 * bboxes together automatically.
 * another draw back is that fabric js will generate the rect automatically when press down the mouse even we make a single click,
 * which make cause some small dot rects.
 * A solution is to split drawing and selection through two button. However, it increases the interaction cost.
 * https://stackoverflow.com/questions/48735537/fabric-js-free-drawing-rectangle-results-in-duplicate
 * 
 * 
 */
function imageAnnotationFreeDraw() {

    $(".bbox-btn").click(async function () {
        currentLabel = this.id;
    });

    var rect, isDown, origX, origY;

    canvas.on('mouse:down', function (o) {
        if (canvas.getActiveObject()) {
            return false;
        }
        isDown = true;
        var pointer = canvas.getPointer(o.e);
        origX = pointer.x;
        origY = pointer.y;
        var pointer = canvas.getPointer(o.e);
        rect = new fabric.Rect({
            left: origX,
            top: origY,
            originX: 'left',
            originY: 'top',
            stroke: '#dc4e43',
            strokeWidth: 2,
            strokeUniform: true,
            width: pointer.x - origX,
            height: pointer.y - origY,
            noScaleCache: false,
            fill: 'rgba(0,0,0,0)',
            transparentCorners: false,
        });
        rect.setControlsVisibility({ mtr: false });
        rect.set({
            transparentCorners: false,
            cornerColor: 'blue',
            cornerStrokeColor: 'red',
            borderColor: 'red',
            cornerSize: 12,
            cornerStyle: 'circle',
            borderDashArray: [3, 3]
        });
        canvas.add(rect);
    });

    canvas.on('mouse:move', function (o) {
        if (!isDown) return;
        var pointer = canvas.getPointer(o.e);

        if (origX > pointer.x) {
            rect.set({ left: Math.abs(pointer.x) });
        }
        if (origY > pointer.y) {
            rect.set({ top: Math.abs(pointer.y) });
        }

        rect.set({ width: Math.abs(origX - pointer.x) });
        rect.set({ height: Math.abs(origY - pointer.y) });


        canvas.renderAll();
    });

    canvas.on('mouse:up', function (o) {
        isDown = false;
        rect.selectable = true;
        // var square = canvas.getActiveObject();
        // square.setCoords();
        let absCoords = canvas.getAbsoluteCoords(rect);
        console.log(absCoords);

    });

    let addControls = function () {
        let closeID = 'close-' + numImages;
        let labelTextID = 'labeltext-' + numImages;


    }

    let insertBBoxInfo = function () {
        //get the current image scale

        //store the information into the obj
    }



}

/**
 * get the actual size and scale of the current image
 * @returns 
 */
function getCurrentImageSize() {
    let coords = canvas.backgroundImage.lineCoords;
    let width = coords.br.x - coords.bl.x;
    let height = coords.bl.y - coords.tl.y;
    let scale = width / imgWidth;
    return {
        'w': width,
        'h': height,
        'scale': scale
    };
}

/**
 * create a new bounding box in the interface
 * @param {*} label_id 
 */
function addNewBoundingBox(label_id) {

    /**
     * 1. get the current background image size
     * 2. calculate the bounding box position
     * 3. 
     */
    bboxIndex = bboxIndex + 1;
    let closeID = 'close-' + bboxIndex;
    let labeltextID = 'labeltext-' + bboxIndex;

    let imageInfo = getCurrentImageSize();

    let box_left, box_top, box_right, box_bottom;
    if (imageInfo['w'] > 200) {
        box_left = imageInfo['w'] * 0.5;
        box_top = imageInfo['h'] * 0.5;
        box_right = box_left + 100;
        box_bottom = box_top + 100;
    }
    else {
        box_left = 0;
        box_top = 0;
        box_right = imageInfo['w'] / 2;
        box_bottom = imageInfo['h'] / 2;
    }

    let box_width = box_right - box_left;
    let box_height = box_bottom - box_top;

    //create bounding box
    let rect = new fabric.Rect({
        left: box_left,
        top: box_top,
        width: box_width,
        height: box_height,
        stroke: labelDict[label_id]['color'],
        strokeWidth: 2,
        strokeUniform: true,
        noScaleCache: false,
        fill: 'rgba(0,0,0,0)'
    });
    rect.setControlsVisibility({ mtr: false });
    rect.set({
        transparentCorners: false,
        cornerColor: 'blue',
        cornerStrokeColor: 'red',
        borderColor: 'red',
        cornerSize: 12,
        cornerStyle: 'circle',
        borderDashArray: [3, 3]
    });
    canvas.add(rect);
    rect.hasChanged = 0;
    //add to the bboxInfo
    let rectObj = {
        'L': box_left / imageInfo['scale'],
        'T': box_top / imageInfo['scale'],
        'R': box_right / imageInfo['scale'],
        'B': box_bottom / imageInfo['scale'],
        'labelID': label_id,
        'index': bboxIndex,
        'labelType': 'human',
        'rectObj': rect
    };

    bboxInfo.push(rectObj);

    //add controls
    var absCoords = canvas.getAbsoluteCoords(rect);
    //label indicator span
    var div = d3.select("body").append("div")
        .attr('pointer-events', 'none')
        .attr("id", labeltextID)
        .attr("class", "type-div")
        .style("background-color", labelDict[label_id]['color'])
        .style("left", (absCoords.left + rect.getScaledWidth() - 2) + 'px')
        .style("top", (absCoords.top + rect.getScaledHeight() - 23) + 'px')
        .append("label")
        .attr("class", "type-label-text")
        .attr("id", labeltextID + '-label')
        .html(labelDict[label_id]['label_name']);

    //draw the close label
    var div = d3.select("body").append("div")
        .attr("class", "close-div")
        .attr("id", closeID)
        .style("left", (absCoords.left + box_width - 7) + 'px')
        .style("top", (absCoords.top - 10) + 'px')
        .append("img")
        .attr("class", "close-img")
        .attr("id", closeID + '-img')
        .attr("src", "../static/images/icons/close.svg")
        .on("click", function () {
            let removeIndex = this.id.split('-')[1];
            let removeArrayIndex = 0;
            let removeData = null;
            bboxInfo.forEach((d, i) => {
                if (d['index'] == removeIndex) {
                    removeArrayIndex = i;
                    removeData = d;
                }
            });
            canvas.remove(removeData['rectObj']);
            canvas.requestRenderAll();
            d3.select('#' + closeID).remove();
            d3.select('#' + labeltextID).remove();
            bboxInfo.splice(removeArrayIndex, 1);
        });

    //control the position of utils
    rect.on('moving', function () {
        positionCtrls(rect, labeltextID);
        positionCtrls(rect, closeID);
    })
    rect.on('rotating', function () {
        positionCtrls(rect, labeltextID);
        positionCtrls(rect, closeID);
    })
    rect.on('scaling', function () {
        positionCtrls(rect, labeltextID);
        positionCtrls(rect, closeID);
    })



}

var positionCtrls = function (obj, controlID) {

    obj.hasChanged = 1; //used for AI-annotation, check if the current bbox has been modified by human

    let absCoords = canvas.getAbsoluteCoords(obj);
    //console.log(obj, absCoords);
    let control = document.getElementById(controlID);
    if (controlID.slice(0, 4) == 'labe') {
        control.style.left = (absCoords.left + obj.getScaledWidth() - 2) + 'px';
        control.style.top = (absCoords.top + obj.getScaledHeight() - 24) + 'px';
    } else if (controlID.slice(0, 4) == 'clos') {
        control.style.left = (absCoords.left + obj.getScaledWidth() - 5) + 'px';
        control.style.top = (absCoords.top - 10) + 'px';
    }

}

/**
 * annotate images by adding a pre-set bounding box 
 */
function imageAnnotation() {
    $(".bbox-btn").click(async function () {
        currentLabel = this.id;
        addNewBoundingBox(currentLabel);
    });


}


/**
 * check whether there is at least one label been labeled in one category
 */
function checkCategory(categ) {
    let status = false;
    document.getElementsByName(categ).forEach((d, i) => {
        let label_id = d.id;
        let className = d.className;
        if (className.includes('check-label') || className.includes('radio-label')) {
            if ($('#' + label_id).is(":checked")) {
                status = true;
            }
        }
        else if (className.includes('text-label')) {
            if ($('#' + label_id).val() != '') {
                status = true;
            }
        }
    });
    // console.log(categ);
    // console.log(status);
    return status;
}


/**
 * check 
 * 1. find all category names
 * 2. for each category, check accomplishment status
 */
function checkAnnotation() {
    if ($('#error-btn').prop("checked")) {
        return true;
    }
    let validateAnnotation = true;
    let categories = [];
    let categoryDic = {};
    $('.category-text').each(function () {
        let label_id = this.id;
        let label_name = this.innerText;
        categoryDic[label_id] = label_name;
        categories.push(label_id);
    });
    categories.forEach((d) => {
        let status = checkCategory(d);
        if (status == false) {
            validateAnnotation = false;
            showAlert('Please select at least one ' + categoryDic[d]);
        }
    });
    if (validateAnnotation) {
        removeAlert();
    }
    return validateAnnotation;
}

function convertDataToDBFormat() {
    let jsonData = [];
    let imageInfo = getCurrentImageSize();
    let scale = imageInfo.scale;

    bboxInfo.forEach((d, i) => {
        let rect = d['rectObj'];
        let L = Math.round((rect.lineCoords.bl.x) / scale);
        let R = Math.round((rect.lineCoords.br.x - 2) / scale);
        let T = Math.round((rect.lineCoords.tl.y) / scale);
        let B = Math.round((rect.lineCoords.bl.y - 2) / scale);
        jsonData.push({
            'L': L,
            'R': R,
            'T': T,
            'B': B,
            'label_id': d['labelID'],
            'label_type': d['labelType']
        });
    });
    //console.log("save: ", jsonData[0]);
    return jsonData;
}

/**
 * 1. update associate labels (only once)
 * another tricky thing is that if we don't annotate, does it mean this image won't belongs to this type?
 * 2. update bounding boxes
 */
async function saveLabels() {
    let annoData = convertDataToDBFormat();
    let storedLabel = [];
    annoData.forEach(async (bbox)=>{
        if(storedLabel.includes(bbox.label_id) == false){
            if(labelDict[bbox.label_id]['label_type'] == 1){
                if(annotationData[bbox.label_id] == 0){
                    storedLabel.push(bbox.label_id);
                    await updateLabel(username, image_id, bbox.label_id, 1, 'int');
                }
            }
            else if(labelDict[bbox.label_id]['label_type'] == 2){
                //kind of tricky here. radio box suppose only have one type
                if(annotationData[labelDict[bbox.label_id]['label_parent']] != bbox.label_id){
                    storedLabel.push(bbox.label_id);
                    await updateLabel(username, image_id, labelDict[bbox.label_id]['label_parent'], bbox.label_id, 'str');
                }
            }
        }
        
    })

    let currentAnnoRes = JSON.stringify(annoData);
    await updateLabel(username, image_id, 'regions', currentAnnoRes, 'str');
    $('#save').addClass('btn-feedback');
    await sleep(500);
    $('#save').removeClass('btn-feedback');
}

/**
 * set up the previous and next actions
 */
function annotationControl() {

    $('#save').unbind('click').click(function () { });
    $("#save").click(async function () {
        saveLabels();
    });

    $('#previous').unbind('click').click(function () { });
    $("#previous").click(async function () {
        if (currentIndex > 0) {
            //update other tags and design caveats
            saveLabels();
            await sleep(500);
            //update user's index and image_id
            let previousIndex = parseInt(currentIndex) - 1;
            let previousImageID = assignment[previousIndex];
            switchFigure(previousImageID, previousIndex);
        }
    });

    $('#next').unbind('click').click(function () { });
    $("#next").click(async function () {
        if (currentIndex < parseInt(imageCount - 1)) {

            saveLabels();
            await sleep(500);
            let nextIndex = parseInt(currentIndex) + 1;
            let nextImageID = assignment[nextIndex];
            //only update when the current coding index is larger than currentIndex in the database
            if (nextIndex > dbIndex) {
                await updateUserBBoxProgress(username, nextIndex);
            }
            switchFigure(nextImageID, nextIndex);

        } else if (parseInt(currentIndex) == parseInt(imageCount - 1)) {

            saveLabels();
            await sleep(500);
            $('.canvas-container').css("display", 'none');
            $('#AnnoPanel').css("display", 'none');
            $('#paper-meta-info').css("display", 'none');
            $('#mark-error-box').css("display", 'none');
            let htmlText = `<p style="font-size:1.0rem;">
    Contratulations! You have completed all encoding tasks!
    <img style="width:2rem; height:2rem; margin-bottom: 5px" src="../static/images/icecream.png"></p>
    `;
            d3.select(".fabric-canvas-wrapper")
                .append("p")
                .html("Contratulations! You have completed all annotation tasks!");

            d3.select(".fabric-canvas-wrapper")
                .append("img")
                .attr("class", "cong-img")
                .attr("src", "../static/images/icecream.png");

            d3.selectAll(".type-div").remove();
            d3.selectAll(".close-div").remove();
            canvas.clear();
            bboxIndex = 0;
            bboxInfo = [];

        }
    });

    $(document).keyup(async function (event) {
        if (event.keyCode == 13) {
            let index_text = $('#image-index-text').val();
            if (index_text != '') {
                if (index_text >= 1 && index_text <= imageCount) {
                    let nextImageID = assignment[index_text - 1];
                    window.location.href = "/annotate-bbox?image_id=" + nextImageID;
                } else {
                    alert("The figure index is not valid!")
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
    $('#ai-btn').prop("checked", false);

    let info = await getBBoxAnnotationInfo(image_id);
    dbIndex = info.current_user_progress;
    annotationData = info['current_annotation_info'][0];
    let log = username + ':' + 'login';
    await updateAnnotationLog(username, image_id, log);
    showAnnotationResults(annotationData);
}


function initLabelColor() {


    Object.keys(labelDict).forEach((label) => {
        if (labelDict[label]['label_type'] != 0) {
            $('#' + label).css("background-color", labelDict[label]['color']);
            $('#' + label).css("border-color", labelDict[label]['color']);
        }
    });


}

