
var colorDic = {};

var labelSchema;
var labelSchemaList;
var labelDict;
var labelIcons;
var labelColorDict;

var img_per_page = 200; //show 200 papers per page
var currentData; //used for pagination
var queryRes;

$(document).ready(async function () {

    /**
     * 1. initialize all query widgets
     * 1.1 user colors
     * 1.2 select all functions
     * 1.3 helper widgets
     * 2. query data
     * 2.1 validate query conditions
     * 2.2 get query screenshot if 2.1 is valid and store to the user logs
     * 2.3 query results
     * 3. present the results
     * 3.1 slice the query results
     * 3.2 layout the query results
     * 3.3 register annotation functions to each grid
     */
    initInterface();
    initQuery();


});

function initQuery() {
    $('#query-btn').unbind('click').click(function () { });
    $("#query-btn").click(async function () {
        let screenshot = queryScreenshot();
        if (validateQuery(screenshot)) {
            screenshot = JSON.stringify(screenshot);
            console.time('query database');
            queryRes = await queryAnnotation(screenshot);

            let countText = 'Image Count: ' + queryRes.length;
            $('#imageCount').text(countText);


            let img_count = queryRes.length;
            let total_pages = Math.ceil(img_count / img_per_page);
            pageUI = new Page({
                id: 'pagination',
                pageTotal: total_pages, //total pages
                pageAmount: img_per_page, //numbers of items per page
                dataTotal: img_count, //number of all items
                curPage: 1, //initial page number
                pageSize: 10, //how many papes divides
                showPageTotalFlag: true, //show data statistics
                showSkipInputFlag: true, //show skip
                getPage: function (page) {
                    currentData = queryRes.slice(img_per_page * (page - 1), img_per_page * page);
                    displayAnnotationResults(currentData);
                }
            });
            console.timeEnd('query database');
            console.log(queryRes);

            currentData = queryRes.slice(img_per_page * 0, img_per_page * 1);
            displayAnnotationResults(currentData);


        }
    });
}

/**
 * change the number of paper figures shown on each page
 */
function changeImagePages() {

    var img_count = queryRes.length;
    var total_pages = Math.ceil(img_count / img_per_page);

    pageUI.pageTotal = total_pages;
    pageUI.pageAmount = img_per_page;
    pageUI.dataTotal = img_count;
    pageUI.curPage = 1;
    pageUI.getPage = function (page) {
        currentData = queryRes.slice(img_per_page * (page - 1), img_per_page * page);
        displayAnnotationResults(currentData);
    };
    pageUI.init();
    currentData = queryRes.slice(img_per_page * 0, img_per_page * 1);
    displayAnnotationResults(currentData);
}

/**
 * display the annotation results in a grid view
 * @param {*} data 
 */
function displayAnnotationResults(data) {

    $('.loader').css("display", 'block');
    $('#anno-instruction').css("display", 'block');
    document.getElementById('annotation-gallery').innerHTML = "";

    let currentUsers = findActiveTags('check-user', false);

    for (let i = 0; i < data.length; i++) {

        let image_id = data[i]['image_id'];

        let recordBox = d3.select("#annotation-gallery")
            .append("div")
            .attr("class", "col-md-4 record-box")
            .append("div")
            .attr("class", "img-grid canvas-div-container")
            .attr("id", 'container-' + image_id)
            .on('click', function (event, d) {
                let queryAnnotators = findActiveTags('check-user', false);
                if (queryAnnotators.includes(username)) {
                    window.open("/annotate-bbox?image_id=" + data[i]['image_id']);
                }
                else {
                    showAlert("Please note that since you are not the originally assigned annotator of this image, directly clicking to modify the annotation results is not allowed.");
                }
            })

        recordBox.append("div")
            .attr("class", 'overview-title')
            .html(data[i]['image_name']);

        recordBox.append("div")
            .attr("class", "image-center-layout")
            .append("canvas")
            .attr("id", 'canvas-' + image_id)
            .attr("class", 'overview-img-canvas')
            .attr("height", 400);

        displayImage('container-' + image_id, 'canvas-' + image_id, data[i]);





    }


    $('.loader').css("display", 'none');
    //lazyLoad();

}

/**
 * display the image on the canvas
 * @param {*} canvasID 
 * @param {*} data 
 */
async function displayImage(containerID, canvasID, data) {

    //init canvas
    let canvas = new fabric.Canvas(canvasID, {
        preserveObjectStacking: true,
        uniformScaling: false
    });
    canvas.selection = false;
    canvas.defaultCursor = "pointer";

    //set up background image
    let containerWidth = document.getElementById(containerID).clientWidth;
    let containerHeight = 400;

    let imgUrl = data['image_url'];

    let img = await getFigureMeta(imgUrl);
    let imgWidth = img.width;
    let imgHeight = img.height;

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
            if (imgHeight <= containerHeight) {
                imgScale = containerWidth / imgWidth;
            }
            else {
                imgScale = containerWidth / imgWidth;
                if (imgHeight * imgScale > containerHeight) {
                    imgScale = containerHeight / imgHeight;
                }
            }
        }

    }

    let canvasWidth = imgWidth * imgScale;
    let canvasHeight = imgHeight * imgScale;

    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

    canvas.setBackgroundImage(imgUrl, canvas.renderAll.bind(canvas), {
        top: 0,
        left: 0,
        originX: 'left',
        originY: 'top',
        scaleX: imgScale,
        scaleY: imgScale
    });

    displayAnnotationBBox(data, canvas, imgScale);


}

/**
 * if there is only one annotator, using line
 * otherwise, using dash-line and lines
 * @param {*} data 
 * @param {*} canvas 
 * @param {*} imgScale 
 */
function displayAnnotationBBox(data, canvas, imgScale) {
    for (let i = 0; i < data.annotators.length; i++) {
        let annotator = data.annotators[i];
        let index = i;
        let annotation = data.annotations[annotator]['regions'];
        let bboxes = null;
        let bboxIndex = 0;
        let bboxInfo = [];
        if (annotation != "") { bboxes = JSON.parse(annotation); }
        if (bboxes != null && bboxes != "") {
            bboxes.forEach((d) => {
                bboxIndex += 1;
                bboxInfo.push({
                    'L': d['L'],
                    'T': d['T'],
                    'R': d['R'],
                    'B': d['B'],
                    'labelID': d['label_id'],
                    'index': bboxIndex
                });
            })
        };
        let dashLength;
        if(index == 0){
            dashLength = [0];
        }
        else{
            dashLength = [5, 1];
        }
        bboxInfo.forEach((d) => {
            let rect = new fabric.Rect({
                left: d['L'] * imgScale,
                top: d['T'] * imgScale,
                width: (d['R'] - d['L']) * imgScale,
                height: (d['B'] - d['T']) * imgScale,
                stroke: labelColorDict[d['labelID']]['color'],
                strokeWidth: 2,
                strokeUniform: true,
                noScaleCache: false,
                fill: 'rgba(0,0,0,0)',
                selectable: false,
                hoverCursor: "pointer",
                strokeDashArray: dashLength
            });
            canvas.add(rect);
        });

    }
}





/**
 * find selected buttons in the query panel
 * @param {*} type 
 * @param {*} prefix 
 */
function findActiveTags(type, prefix) {
    let activeTags = [];
    $('.' + type).each(function () {
        let id = this.id;
        if ($('#' + id).is(":checked")) {
            if (prefix) {
                activeTags.push(id.split('-')[1]);
            }
            else {
                activeTags.push(id);
            }
        }
    });
    return activeTags;
}

/**
 * find selected labels in the query panel
 * @param {*} type 
 * @param {*} prefix 
 */
function findActiveLabels(type) {
    let activeTags = [];
    $('.' + type).each(function () {
        let id = this.id;
        let parent = this.name;
        let type = $('#' + id).attr('ltype');
        if ($('#' + id).is(":checked")) {
            activeTags.push({
                'id': id,
                'parent': parent,
                'type': type
            });
        }
    });
    return activeTags;
}

function getTagStatus(id) {
    if ($('#' + id).is(":checked")) {
        return 1;
    }
    else {
        return 0;
    }
}

/**
 * validate if the current query is a valid
 */
function validateQuery(screenshot) {
    let ifValid = 1;
    if (screenshot.users.split(',').length == 1) {
        if (screenshot.consistencyMode != 2) {
            ifValid = 0;
            showAlert('please select at least two authors.');
        }
    }
    return ifValid;
}


function findQueryMode(type) {
    if ($('#' + type + '-querymode-1').is(":checked")) {
        return 1;
    }
    else {
        return 2;
    }
}

/**
 * group labels by category
 * append the query mode to the results
 * @param {*} currentLabels 
 */
function generateLabelGroups(currentLabels) {
    let labelGroups = {};
    currentLabels.forEach((d, i) => {
        if (d['parent'] in labelGroups) {
            labelGroups[d['parent']]['labels'].push(d);
        }
        else {
            labelGroups[d['parent']] = {
                'queryMode': findQueryMode(d['parent']),
                'labels': [d]
            };

        }
    })
    return labelGroups;
}

/**
 * get the configuration of the current query
 */
function queryScreenshot() {

    let currentUsers = findActiveTags('check-user', false);
    currentUsers = currentUsers.join(',');
    let userQueryMode = findActiveTags('querymode-radio-user', true)[0]
    let currentLabels = findActiveLabels('check-label');
    let labelGroups = generateLabelGroups(currentLabels);
    let currentTypes = findActiveTags('check-type', true);
    currentTypes = currentTypes.join(',');
    let currentYears = findActiveTags('check-year', true);
    currentYears = currentYears.join(',');
    let consistencyMode = findActiveTags('check-consistency', true);
    consistencyMode = consistencyMode.join(',');
    let isExclude = getTagStatus('exclude-check');
    let isFun = getTagStatus('fun-check');
    let isOK = getTagStatus('ok-check');
    let isDiscuss = getTagStatus('discuss-check');
    let sortMode = findActiveTags('check-sort', true);
    sortMode = sortMode.join(',');

    let screenshot = {
        'users': currentUsers,
        'userQueryMode': userQueryMode,
        'labels': labelGroups,
        'types': currentTypes,
        'years': currentYears,
        'consistencyMode': consistencyMode,
        'isExclude': isExclude,
        'isFun': isFun,
        'isOK': isOK,
        'isDiscuss': isDiscuss,
        'sortMode': sortMode
    }
    //console.log(screenshot);
    return screenshot;
}

/**
 * initialze all query widgets
 */
function initInterface() {
    initUserColor();
    initControls();
    initHelper();
    initSchema();
    initIcons();
}

function lazyLoad() {
    const imageToLazy = document.querySelectorAll('img[data-src]');
    const loadImage = function (image) {
        image.setAttribute('src', image.getAttribute('data-src'));
        image.addEventListener('load', function () {
            image.removeAttribute("data-src");
        })
    }


    const intersectionObserver = new IntersectionObserver(function (items, observer) {
        items.forEach(function (item) {
            if (item.isIntersecting) {
                loadImage(item.target);
                observer.unobserve(item.target);
            }
        });
    });

    imageToLazy.forEach(function (image) {
        intersectionObserver.observe(image);
    })
}

async function initIcons() {
    labelIcons = await getLabelIcons();
}


async function initSchema() {
    let schemaData = await getLabelSchema();
    labelSchema = schemaData['hierarchical_schema'];
    labelDict = schemaData['schema'];
    labelSchemaList = schemaData['schema_list'];
    labelColorDict = await getDistictLabelColors();
}

/**
 * init the helper functions
 */
function initHelper() {
    $("#query-mode-box-union").tooltip();
    $("#query-mode-box-intersect").tooltip();
    $("#exclude-exp-box").tooltip();
}

/**
 * init the button actions
 */
function initControls() {
    //user selection
    $("#user-select-all").click(function () {
        if ($('#user-select-all').is(":checked")) {
            $('.check-user').prop("checked", true);
        }
        else {
            $('.check-user').prop("checked", false);
        }
    });
    $(".check-user").click(function () {
        if (!$(this).is(":checked")) {
            $('#user-select-all').prop("checked", false);
        }
    });

    //year selection
    $("#year-select-all").click(function () {
        if ($('#year-select-all').is(":checked")) {
            $('.check-year').prop("checked", true);
        }
        else {
            $('.check-year').prop("checked", false);
        }
    });
    $(".check-year").click(function () {
        if (!$(this).is(":checked")) {
            $('#year-select-all').prop("checked", false);
        }
    });


}

/**
 * color the user buttons
 */
async function initUserColor() {

    colorDic = await getDistinctUserColor();
    Object.keys(colorDic).forEach((user) => {
        $('#' + user + '-label').css("box-shadow", `inset 0px 0px 0px 3px ${colorDic[user]}`);
        $('#' + user + '-label').css("border-color", colorDic[user]);
    });

    //highlight the current user
    $('#' + username).prop("checked", true);

}

