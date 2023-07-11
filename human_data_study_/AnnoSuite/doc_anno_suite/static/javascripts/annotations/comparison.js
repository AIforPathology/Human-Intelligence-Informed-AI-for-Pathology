
var colorDic = {};

var labelSchema;
var labelSchemaList;
var labelDict;
var labelIcons;

var comparisonLabels;
var recentDragImageID = [];


$(document).ready(async function () {

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
            let queryRes = await queryAnnotation(screenshot);
            console.timeEnd('query database');
            console.log(queryRes);
            displayComparisonResults(queryRes);
        }
    });
}


async function refreshPage() {
    let screenshot = queryScreenshot();
    if (validateQuery(screenshot)) {
        screenshot = JSON.stringify(screenshot);
        console.time('query database');
        let queryRes = await queryAnnotation(screenshot);
        console.timeEnd('query database');
        console.log(queryRes);
        displayComparisonResults(queryRes);
    }
}

/**
 * given the query results and label, filter all images with annotations corresponding to the given label
 * @param {*} data 
 * @param {*} label 
 */
function filterAnnotationsByLabel(data, label) {
    let labelType = labelDict[label]['label_type'];
    let labelParent = labelDict[label]['label_parent'];
    let filterRes = data.filter((record) => {
        let flag = false;
        record.annotators.forEach((user) => {
            if (labelType == 1) {
                if (record.annotations[user][label] == 1) {
                    flag = true;
                }
            }
            else if (labelType == 2) {
                if (record.annotations[user][labelParent] == label) {
                    flag = true;
                }
            }
            else if (labelType == 3) {
                if (record.annotations[user][label] != "") {
                    flag = true;
                }
            }
        });
        return flag;
    })
    return filterRes;

}


/**
 * display results side by side
 * @param {*} data 
 * 1. determine which category was selected
 * 2. if exclude, the tags should be exclude
 * 3. if there is no tag selected, warning
 * 4. create divs for each category
 */
function displayComparisonResults(data) {

    $('.loader').css("display", 'block');
    document.getElementById('annotation-gallery').innerHTML = "";

    let category = findActiveTags('comparison-radio', true);
    let activeLabels = findActiveLabelsByCategory(category[0]);

    let numOfColumns = activeLabels.length;
    let width = (100 - numOfColumns) / numOfColumns; // width of the div

    comparisonLabels = [];
    activeLabels.forEach((d, i) => {
        //create the outer divs
        let containerDiv = document.createElement("div");
        containerDiv.className = "comp-label-container";
        containerDiv.id = 'comp-label-container-' + d;
        comparisonLabels.push('comp-label-container-' + d);
        containerDiv.setAttribute("style", "width:" + width + "%");
        containerDiv.innerHTML = `
        <div class = "comp-label-container-title">
            ${labelDict[d]['label_name']} <span id="count-${d}"></span>
        </div>
        <div class="row-responsive"> 
            <div class="column-responsive" id="column-${d}-1">
            </div>
            <div class="column-responsive" id="column-${d}-2">
            </div>
            <div class="column-responsive" id="column-${d}-3">
            </div>
            <div class="column-responsive" id="column-${d}-4">
            </div>
        </div>
        `;
        document.getElementById("annotation-gallery").appendChild(containerDiv);

        //get all data and display in the div
        let images = filterAnnotationsByLabel(data, d);
        $('#count-' + d).text(" (count:" + images.length + ")");

        images.forEach((img, j) => {
            let index = j + 1;
            let imgDiv = document.createElement("img");
            let imageID = img['image_id'];
            imgDiv.id = 'figure-' + imageID;
            imgDiv.className = "comp-figure lazy";
            imgDiv.setAttribute("style", "width:100%");
            imgDiv.setAttribute("loading", "lazy");
            imgDiv.setAttribute("src", '../static/images/placeHolder-gray.png');
            imgDiv.setAttribute("data-src", img['image_url']);
            if (index % 4 == 1) {
                document.getElementById("column-" + d + "-1").appendChild(imgDiv);
            } else if (index % 4 == 2) {
                document.getElementById("column-" + d + "-2").appendChild(imgDiv);
            } else if (index % 4 == 3) {
                document.getElementById("column-" + d + "-3").appendChild(imgDiv);
            } else if (index % 4 == 0) {
                document.getElementById("column-" + d + "-4").appendChild(imgDiv);
            }

        });




    });

    lazyLoad();
    dragInteractions();

    //left click event
    $('.comp-figure').click(function (e) {
        var imageID = this.id.split('-')[1];
        let currentUsers = findActiveTags('check-user', false);
        if (currentUsers.includes(username)) {
            //console.log(id, userID);
            window.open("/annotate?image_id=" + imageID);
        }
        else {
            showAlert("Please note that since you are not the originally assigned annotator of this image, directly clicking to modify the annotation results is not allowed.");
        }

    });



    $('.loader').css("display", 'none');

}


function dragInteractions() {
    //highlight the recent dragged figure
    if (recentDragImageID.length != 0) {
        let recentID = recentDragImageID[recentDragImageID.length - 1];
        $('#figure-' + recentID).css('border', 'solid 3px #fbff00');
    }

    //right drag event
    //https://www.w3schools.com/howto/howto_js_draggable.asp
    var collection = document.getElementsByClassName("comp-figure");
    $('.comp-figure').contextmenu(function (e) { return false });
    for (let i = 0; i < collection.length; i++) {
        dragElement(collection[i]);
    }

}

var cumulativeOffset = function (element) {
    var top = 0,
        left = 0;
    do {
        top += element.offsetTop || 0;
        left += element.offsetLeft || 0;
        element = element.offsetParent;
    } while (element);

    return {
        top: top,
        left: left
    };
};

/**
 * make the html element become draggable
 * @param {DOM element} elmnt 
 */
function dragElement(elmnt) {
    var pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
    elmnt.onmousedown = dragMouseDown;
    var sourceCategory = ''; //original category
    var image_id = elmnt.id.split('-')[1];

    /**
     * given the position, find it's corresponding category
     * @param {number} top 
     * @param {number} left 
     */
    function getCategory(top, left) {
        var res = '';
        comparisonLabels.forEach((d, i) => {
            let htmlObj = document.getElementById(d);
            let target_top = cumulativeOffset(htmlObj).top;
            let target_left = cumulativeOffset(htmlObj).left;
            let target_width = htmlObj.offsetWidth;
            //let target_height = htmlObj.offsetHeight;
            if ((top > target_top) && (left > target_left) && (left < target_left + target_width)) {
                res = d;
            }
        })
        return res;
    }

    function dragMouseDown(e) {
        //only use right click
        if (e.which == 3) {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            // change the style of this figure to absolute position
            let width = elmnt.width + 4;
            let height = elmnt.height + 4;
            let top = cumulativeOffset(elmnt).top - 8;
            let left = cumulativeOffset(elmnt).left;
            elmnt.style.width = width + 'px';
            elmnt.style.height = height + 'px';
            elmnt.style.position = 'absolute';
            elmnt.style.top = top + "px";
            elmnt.style.left = left + "px";
            document.onmouseup = closeDragElement;
            //get the current image id and its' category
            sourceCategory = getCategory(top, left);
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }

    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        let offset = cumulativeOffset(elmnt);
        let top = offset.top - 8 - pos2;
        let left = offset.left - pos1;
        elmnt.style.top = top + "px";
        elmnt.style.left = left + "px";
        let currentCategory = getCategory(top, left);
        if ((currentCategory != sourceCategory) && (currentCategory != '')) {
            $('#changingHint').html('Move to ' + labelDict[currentCategory.split('-')[3]]['label_name']);

            document.getElementById('changingHint').style.display = 'block';
            document.getElementById('changingHint').style.top = (top - 20) + 'px';
            document.getElementById('changingHint').style.left = (left) + 'px';
        } else {
            $('#changingHint').css('display', 'none');
        }

    }

    /**
     * 1. the label is not type 3
     * 2. two labels have different type
     * @param {*} label1 
     * @param {*} label2 
     * @returns 
     */
    function validateDragging(label1, label2) {
        let ifValid = true;
        if (labelDict[label1]['label_type'] == 3 || labelDict[label2]['label_type'] == 3) {
            ifValid = false;
            showAlert("The free-text attribute is not allowed to modify through this interface.");
        }
        else if (labelDict[label1]['label_type'] != labelDict[label2]['label_type']) {
            ifValid = false;
            showAlert("The destination label should have the same type with the original label");
        }
        else if (label1 == label2) {
            ifValid = false;
            showAlert("Please choose a different label");
        }
        return ifValid;

    }

    async function closeDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
        //check the position of the element
        document.getElementById('changingHint').style.display = 'none';
        let top = cumulativeOffset(elmnt).top;
        let left = cumulativeOffset(elmnt).left;
        let currentCategory = getCategory(top, left);
        if (currentCategory != '') {
            //store results
            //only allowed when 1: the current username is equals to the user who annotated this figure

            let currentUsers = findActiveTags('check-user', false);
            if (currentUsers.includes(username)) {
                let originalLabel = sourceCategory.split('-')[3];
                let targetLabel = currentCategory.split('-')[3];
                if (validateDragging(originalLabel, targetLabel)) {
                    //console.log(originalLabel, targetLabel);
                    if (labelDict[targetLabel]['label_type'] == 1) {
                        //1. cancel the original label
                        //2. update the new label
                        await updateLabel(username, image_id, originalLabel, 0, 'int');
                        await updateLabel(username, image_id, targetLabel, 1, 'int');
                    }
                    else if (labelDict[targetLabel]['label_type'] == 2) {
                        //update the parent label
                        let label_parent = labelDict[targetLabel]['label_parent'];
                        await updateLabel(username, image_id, label_parent, targetLabel, 'str');
                    }
                    recentDragImageID.push(image_id);
                }

            } else {
                showAlert("Please note that since you are not the originally assigned annotator of this image, directly dragging to modify the annotation results is not allowed.");
            }


            //refresh the results
            refreshPage();

        }

    }
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

/**
 * find all selected label in a category
 */
function findActiveLabelsByCategory(category) {
    let activeLabels = [];
    let allLabels = [];

    document.getElementsByName(category).forEach((d, i) => {
        let id = d.id;
        allLabels.push(id);
        if ($('#' + id).is(":checked")) {
            activeLabels.push(id);
        }
    });
    if (activeLabels.length == 0) {
        activeLabels = allLabels;
    }
    return activeLabels;
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
                'queryMode': 1,
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
    let userQueryMode = 1;
    let currentLabels = findActiveLabels('check-label');
    let labelGroups = generateLabelGroups(currentLabels);
    let currentTypes = findActiveTags('check-type', true);
    currentTypes = currentTypes.join(',');
    let currentYears = findActiveTags('check-year', true);
    currentYears = currentYears.join(',');
    let consistencyMode = findActiveTags('check-consistency', true);
    consistencyMode = consistencyMode.join(',');
    let isExclude = 0;
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

async function initIcons() {
    labelIcons = await getLabelIcons();
}

async function initSchema() {
    let schemaData = await getLabelSchema();
    labelSchema = schemaData['hierarchical_schema'];
    labelDict = schemaData['schema'];
    labelSchemaList = schemaData['schema_list'];
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

