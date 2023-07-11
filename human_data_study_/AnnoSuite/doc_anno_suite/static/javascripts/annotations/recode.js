
var colorDic = {};

var labelSchema;
var labelSchemaList;
var labelDict;
var labelIcons;

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
            $('.loader').css("display", 'inline-block');
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

    $('.loader').css("display", 'inline-block');

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
 * 1. display the loader gif and instruction text
 * 2. reset the annotation-gallery
 * 3. traverse the results
 *  0. get meta info
 *  1. concat the type3 annotations
 *  2. check the caption, paper, todiscuss, and fun icons
 *  3. check the isOK icons
 *  4. dynamically create the html grid
 *  5. creat the icons within the icon grid using d3 so we could add event easily, based on the labeling schema
 *  6. add event for the update button
 *  7. add event for caption, paper, todiscuss, and fun icons
 * 4. hide the loader gif
 * @param {*} data 
 */
function displayAnnotationResults(data) {

    
    $('#anno-instruction').css("display", 'block');
    document.getElementById('annotation-gallery').innerHTML = "";

    let freetextLabels = [];
    labelSchemaList.forEach((d) => {
        if (labelDict[d]['label_type'] == 3) {
            freetextLabels.push(d);
        }
    });

    let currentUsers = findActiveTags('check-user', false);

    console.time("render tooltip");
    for (let i = 0; i < data.length; i++) {

        let image_id = data[i]['image_id'];

        let recordBox = d3.select("#annotation-gallery")
            .append("div")
            .attr("class", "col-md-4 record-box")
            .append("div")
            .attr("class", "img-grid")

        recordBox.append("div")
            .attr("class", "img-box")
            .append("img")
            .attr("class", "anno-img")
            .attr("src", '../static/images/placeHolder-gray.png')
            //.attr("src", '../static/images/image-placeholder.gif')
            .attr("data-src", data[i]['image_url'])
            .on('click', function (event, d) {
                let queryAnnotators = findActiveTags('check-user', false);
                if (queryAnnotators.includes(username)) {
                    window.open("/annotate?image_id=" + data[i]['image_id']);
                }
                else {
                    showAlert("Please note that since you are not the originally assigned annotator of this image, directly clicking to modify the annotation results is not allowed.");
                }
            })

        recordBox.append("div")
            .attr("class", "label-box")
            .attr("id", "label-box-" + image_id)

        recordBox.append("div")
            .attr("class", "widget-box")
            .attr("id", "widget-box-" + image_id)

        recordBox.append("div")
            .attr("class", "freetext-box")
            .attr("id", "freetext-box-" + image_id)

        displayLabels("label-box-" + image_id, data[i]);
        displayWidgets("widget-box-" + image_id, data[i], currentUsers, freetextLabels);
        displayTextBoxes("freetext-box-" + image_id, data[i], freetextLabels);
    }


    
    lazyLoad();
    console.timeEnd("render tooltip");
    $('.loader').css("display", 'none');
    


}

/**
 * display free-text annotations
 * @param {*} divID 
 * @param {*} data 
 */
function displayTextBoxes(divID, data, freetextLabels) {

    //1. determine how many free-text box do we have
    d3.select("#" + divID).selectAll("freetext-row")
        .data(freetextLabels)
        .join("div")
        .attr("class", "freetext-row")
        .html(function (d) {
            let text = '';
            data['annotators'].forEach((annotator) => {
                if (data['annotations'][annotator][d] != null && data['annotations'][annotator][d] != '') {
                    text += annotator + ':' + data['annotations'][annotator][d] + '; ';
                }
            })
            let label_name = labelDict[d]['label_name'];
            if(label_name == null){
                label_name = labelDict[labelDict[d]['label_parent']]['label_name'];
            }
            
            return `
            <label class="input-text">${label_name}</label>
            <textarea class="form-control text-label" id="${data['image_id']}-${d}">${text}</textarea>
            `;
        });

}

/**
 * check if the current freetext is valid
 * @param {*} freetextLabels 
 */
function checkFreeText(freetextLabels, imageID) {

    let validText = true;
    let parsedRes = {};
    let errorMsg = "Please enter the text in the format of: <username>:<text>. e.g. Jack:photo. Please do not include ';' or ':' in your <text>.";
    freetextLabels.forEach((d) => {

        //check if the text contains the ':'
        let text = $('#' + imageID + '-' + d).val();
        let parsedText = '';
        if (text.includes(':') == false) {
            validText = false;
        }
        //check if the parsed results contain the current username
        let userExist = false; //check if the user exist after parsing
        text = text.split(/; |;/); //split by annotators
        console.log(text);
        text.forEach((group) => {
            let textArr = group.split(':');
            if(textArr.length > 2){
                validText = false;
            }
            if (textArr.includes(username)) {
                userExist = true;
                parsedText = textArr[1];
                if (d in parsedRes) { parsedRes[d] += parsedText; }
                else { parsedRes[d] = parsedText; }

            }
        });
        if (userExist == false) {
            validText = false;
        }
    });
    return {
        'validText': validText,
        'parsedRes': parsedRes,
        'errorMsg': errorMsg
    };

}

function showFreeTextFeedback(freetextLabels, imageID) {
    freetextLabels.forEach((d) => {
        d3.select('#' + imageID + '-' + d).style("box-shadow", "inset 0px 0px 0px 1px #e67e22");
    });
}

function removeFreeTextFeedback(freetextLabels, imageID) {
    freetextLabels.forEach((d) => {
        d3.select('#' + imageID + '-' + d).style("box-shadow", "");
    });
}


/**
 * display annotation widgets such as caption, paper, etc.
 * @param {*} divID 
 * @param {*} data 
 */
function displayWidgets(divID, data, currentUsers, freetextLabels) {

    let widgetRow = d3.select("#" + divID)
        .append("div")
        .attr("class", "widget-row row");

    widgetRow.append("div").attr("class", "col-icon col-1")

    widgetRow.selectAll("ok-icon")
        .data(data.annotators)
        .join("div")
        .attr("class", "col-icon col-1")
        .append("img")
        .attr("src", function (d) {
            if (data['annotations'][d]['marked_OK'] == 0) {
                return "../static/images/icons/happy-0.png";
            }
            else {
                return "../static/images/icons/happy-1.png";
            }
        })
        .attr("isOK", function (d) {
            if (data['annotations'][d]['marked_OK'] == 0) {
                return 0;
            }
            else {
                return 1;
            }
        })
        .attr("title", function (d) {
            let titleName = '';
            if (d == username) { titleName = "I am" }
            else { titleName = d + ' is' };
            return titleName + " happy with the annotation inconsistency.";
        })
        .attr("data-toggle", "tooltip")
        .classed("widget-icon", true)
        .classed("happy-icon", true)
        .on('click', async function (event, d) {
            if (d == username) {
                if (parseInt(d3.select(this).attr("isOK")) == 1) {
                    await updateLabel(username, data['image_id'], 'marked_OK', 0, 'int');
                    d3.select(this).attr("isOK", 0);
                    d3.select(this).attr("src", "../static/images/icons/happy-0.png");
                }
                else if (parseInt(d3.select(this).attr("isOK")) == 0) {
                    await updateLabel(username, data['image_id'], 'marked_OK', 1, 'int');
                    d3.select(this).attr("isOK", 1);
                    d3.select(this).attr("src", "../static/images/icons/happy-1.png");
                }
            }
            else {
                showAlert('You can only make changes to your own annotation results.');
            }

        });

    $('.happy-icon').tooltip();

    widgetRow.append("div")
        .attr("class", "col-icon col-1")
        .append("img")
        .attr("src", function () {
            if (data['annotations'][data['annotators'][0]]['need_discuss'] == 0) {
                return "../static/images/icons/discuss-0.png";
            }
            else {
                return "../static/images/icons/discuss-1.png";
            }
        })
        .attr("isDiscuss", function () {
            if (data['annotations'][data['annotators'][0]]['need_discuss'] == 0) {
                return 0;
            }
            else {
                return 1;
            }
        })
        .attr("data-toggle", "tooltip")
        .attr("title", "mark as a to-discuss figure")
        .classed("widget-icon discuss-btn", true)
        .on('click', async function (event) {
            if (parseInt(d3.select(this).attr("isDiscuss")) == 1) {
                await updateLabelAll(username, data['image_id'], 'need_discuss', 0, 'int');
                d3.select(this).attr("isDiscuss", 0);
                d3.select(this).attr("src", "../static/images/icons/discuss-0.png");
            }
            else if (parseInt(d3.select(this).attr("isDiscuss")) == 0) {
                await updateLabelAll(username, data['image_id'], 'need_discuss', 1, 'int');
                d3.select(this).attr("isDiscuss", 1);
                d3.select(this).attr("src", "../static/images/icons/discuss-1.png");
            }
        });

    $('.discuss-btn').tooltip();

    widgetRow.append("div")
        .attr("class", "col-icon col-1")
        .append("img")
        .attr("src", function () {
            if (data['annotations'][data['annotators'][0]]['marked_fun'] == 0) {
                return "../static/images/icons/fun-0.png";
            }
            else {
                return "../static/images/icons/fun-1.png";
            }
        })
        .attr("isFun", function () {
            if (data['annotations'][data['annotators'][0]]['marked_fun'] == 0) {
                return 0;
            }
            else {
                return 1;
            }
        })
        .attr("data-toggle", "tooltip")
        .attr("title", "mark as a fun figure")
        .classed("widget-icon fun-btn", true)
        .on('click', async function (event) {
            if (parseInt(d3.select(this).attr("isFun")) == 1) {
                await updateLabelAll(username, data['image_id'], 'marked_fun', 0, 'int');
                d3.select(this).attr("isFun", 0);
                d3.select(this).attr("src", "../static/images/icons/fun-0.png");
            }
            else if (parseInt(d3.select(this).attr("isFun")) == 0) {
                await updateLabelAll(username, data['image_id'], 'marked_fun', 1, 'int');
                d3.select(this).attr("isFun", 1);
                d3.select(this).attr("src", "../static/images/icons/fun-1.png");
            }
        });

    $('.fun-btn').tooltip();

    widgetRow.append("div")
        .attr("class", "col-icon col-1")
        .append("img")
        .attr("src", function () {
            if (data['annotations'][data['annotators'][0]]['checked_caption'] == 0) {
                return "../static/images/icons/caption-0.png";
            }
            else {
                return "../static/images/icons/caption-1.png";
            }
        })
        .attr("ifClicked", 0)
        .attr("data-toggle", "tooltip")
        .attr("title", "show caption")
        .classed("widget-icon caption-btn", true)
        .on('click', async function (event) {
            if (d3.select(this).attr("ifClicked") == 0) {
                d3.select(this).attr("ifClicked", 1);
                let captionText = data['caption_url'];
                d3.select('#caption-tooltip-' + data['image_id']).remove();
                if (captionText !== null) {

                    var img = await getFigureMeta(captionText);
                    var width = img.width;
                    var height = img.height;
                }
                $(this).after(function () {
                    if (captionText !== null) {
                        //console.log(width, height);
                        let max_width = width / 2.5;
                        let capHTML = `<img class="caption-tooltip" id="caption-tooltip-${data['image_id']}" style="max-width: ${max_width}px;" src="${captionText}">`;
                        return capHTML;
                    } else {
                        let capHTML = `<span class="caption-tooltip" id="caption-tooltip-${data['image_id']}" >No caption associated with this figure</span>`;
                        return capHTML;
                    }
                });
                if (captionText !== null) {
                    var left = $(this).position().left - width / 10;
                } else {
                    var left = $(this).position().left + $(this).width() - 100;
                }
                var top = $(this).position().top + 20;
                $(this).next().css('left', left);
                $(this).next().css('top', top);

                await updateLabelAll(username, data['image_id'], 'checked_caption', 1, 'int');
                d3.select(this).attr("src", "../static/images/icons/caption-1.png");
            }
            else {
                d3.select(this).attr("ifClicked", 0);
                d3.select('#caption-tooltip-' + data['image_id']).remove();
            }



        });

    $('.caption-btn').tooltip();

    widgetRow.append("div")
        .attr("class", "col-icon col-1")
        .append("img")
        .attr("src", function () {
            if (data['annotations'][data['annotators'][0]]['checked_paper'] == 0) {
                return "../static/images/icons/paper-link-0.png";
            }
            else {
                return "../static/images/icons/paper-link-1.png";
            }
        })
        .attr("ifClicked", function () {
            if (data['annotations'][data['annotators'][0]]['checked_paper'] == 0) {
                return 0;
            }
            else {
                return 1;
            }
        })
        .attr("data-toggle", "tooltip")
        .attr("title", "link to the paper")
        .classed("widget-icon paper-btn", true)
        .on('click', async function (event) {
            window.open(data['paper_url'], "_blank");
            await updateLabelAll(username, data['image_id'], 'checked_paper', 1, 'int');
            d3.select(this).attr("ifClicked", 1);
            d3.select(this).attr("src", "../static/images/icons/paper-link-1.png");
        });

    $('.paper-btn').tooltip();

    widgetRow.append("div").attr("class", "col-icon widget-btn-col col-1")

    widgetRow.append("div")
        .attr("class", "col-icon col-3")
        .append("button")
        .attr("class", "btn btn-primary widget-btn")
        .html("update")
        .on('click', async function (event) {
            /**
             * 1. for each textbox, check if the current format is valid
             * 2. if all valid, update the text
             */
            let checkRes = checkFreeText(freetextLabels, data['image_id']);
            if (checkRes['validText']) {
                Object.keys(checkRes['parsedRes']).forEach(async (label_id) => {
                    let text = checkRes['parsedRes'][label_id];
                    await updateLabel(username, data['image_id'], label_id, text, 'str');
                });
                showFreeTextFeedback(Object.keys(checkRes['parsedRes']), data['image_id']);
                await sleep(500);
                removeFreeTextFeedback(Object.keys(checkRes['parsedRes']), data['image_id']);
            }
            else {
                showAlert(checkRes['errorMsg']);
            }
        });

}


/**
 * get the border color of the icon
 * given a icon label. if the label is placeHolder, return '#fff'
 * if the label is currently selected by only one user, return the user color
 * if the label is selected by two users. determine the color based on the boder order (left, right, bottom, top)
 * @param {str} label - the label id of the given icon
 * @param {arr} selectedAnnotators - the users who currently selected the icon
 * @param {arr} annotators - the ordered (alphabetical) users who annotated this image (based on the query results), 1-2 users
 * @param {int} order - determine which border we want to color. 0: first user, 1: second user
 *  first annotator should correspond to the top and bottom border
 *  second annotator should correspond to the left and right border
 */
function getBorderColors(label, selectedAnnotators, annotators, order) {
    if (label != 'placeHolder') {
        if (selectedAnnotators.length == 0) {
            return '#fff';
        }
        else if (selectedAnnotators.length == 1) {
            return colorDic[selectedAnnotators[0]];
        }
        else if (selectedAnnotators.length == 2) {
            return colorDic[annotators[order]];
        }
    }
    else {
        return '#fff';
    }
}


function updateIconStyles(that, currentAnnotators, annotators) {
    // d3.select(that).style("box-shadow", function (d) {
    //     return 'inset 0px 3px 0px ' + getBorderColors('', currentAnnotators, annotators, 0) + ',' +
    //         'inset 0px -3px 0px ' + getBorderColors('', currentAnnotators, annotators, 0) + ',' +
    //         'inset 3px 0px 0px ' + getBorderColors('', currentAnnotators, annotators, 1) + ',' +
    //         'inset -3px 0px 0px ' + getBorderColors('', currentAnnotators, annotators, 1);
    // })
    d3.select(that).style("border-top", function (d) { return "solid 3px " + getBorderColors('', currentAnnotators, annotators, 0) })
    d3.select(that).style("border-bottom", function (d) { return "solid 3px " + getBorderColors('', currentAnnotators, annotators, 0) })
    d3.select(that).style("border-left", function (d) { return "solid 3px " + getBorderColors('', currentAnnotators, annotators, 1) })
    d3.select(that).style("border-right", function (d) { return "solid 3px " + getBorderColors('', currentAnnotators, annotators, 1) })
}

/**
 * check the annotation consistency of a set of label
 * note: we only check the type 1 and type 2 label (checkbox and radio labels) here
 * @param {*} labels - all labels under a specific category
 * @param {*} data 
 */
function checkCategoryConsistency(labels, data) {
    let users = Object.keys(data);
    //we don't consider the consistency when only 1 annotator was selected
    if (users.length == 1) {
        return '../static/images/icons/placeHolder.png';
    }
    else {
        for (let i = 0; i < labels.length; i++) {
            let label_id = labels[i];
            if (labelDict[label_id]['label_type'] == 1) {
                if (data[users[0]][label_id] != data[users[1]][label_id]) {
                    return '../static/images/icons/inconsistent.png';
                }
            }
            else if (labelDict[label_id]['label_type'] == 2) {
                if (data[users[0]][labelDict[label_id]['label_parent']] != data[users[1]][labelDict[label_id]['label_parent']]) {
                    return '../static/images/icons/inconsistent.png';
                }
            }
        }
        return '../static/images/icons/placeHolder.png';
    }
}

/**
 * update the consistency indicator
 * @param {*} category: the label category
 * @param {*} image_id 
 */
function updateCategoryConsistency(category, image_id) {
    // d3.selectAll('.' + image_id + '-' + category)
    let ifConsistent = 1;
    let queryAnnotators = findActiveTags('check-user', false);
    if (queryAnnotators.length == 2) {
        $('.' + image_id + '-' + category).each(async function () {
            let selectedAnnotators = $('#' + this.id).attr("annotatedUsers").split('-');
            if (selectedAnnotators.length == 1) {
                if (selectedAnnotators[0] != '') {
                    ifConsistent = 0;
                }
            }
        });
        if (ifConsistent) {
            d3.select("#" + image_id + '-' + category).attr('src', '../static/images/icons/placeHolder.png')
        }
        else {
            d3.select("#" + image_id + '-' + category).attr('src', '../static/images/icons/inconsistent.png')
        }
    }
}

/**
 * reset the annotatedUsers attribute of all labels under the given labels
 * reset the icon border of all labels under the given labels
 * @param {*} labels 
 * @param {*} image_id 
 */
function removeAnnotationsByLabels(labels, imageID, annotators) {

    labels.forEach((d) => {
        let id = '#' + imageID + '-' + d;
        let selectedAnnotators = d3.select(id).attr("annotatedUsers").split('-');
        removeArrayElement(selectedAnnotators, '');
        removeArrayElement(selectedAnnotators, username);
        d3.select(id).attr("annotatedUsers", selectedAnnotators.join('-'));
        updateIconStyles(id, selectedAnnotators, annotators);
    })

}

/**
 * display the label icons
 * @param {*} divID 
 * @param {*} data 
 */
function displayLabels(divID, data) {

    /**
     * 1. coder information
     * 2. label icons
     */
    //annotator row
    let annotatorRow = d3.select("#" + divID)
        .append("div")
        .attr("class", "annotator-row")

    annotatorRow.selectAll("annotator-span")
        .data(data.annotators)
        .join("span")
        .classed("annotator-dot", true)
        .style("background-color", function (d) {
            return colorDic[d];
        })
        .attr("title", function (d) {
            return d;
        })
        .attr("data-toggle", "tooltip")

    $(".annotator-dot").tooltip();

    //category row with icons
    for (let i = 0; i < labelSchema.length; i++) {

        if (labelSchema[i].children.length == 0) {
            continue;
        }

        let categoryRow = d3.select("#" + divID)
            .append("div")
            .attr("class", "row category-row");
        let labels = labelSchema[i]['children'];
        let category_id = labelSchema[i]['category_id'];

        //determine the order of annotators, for the purpose of styling icons
        let annotators = [...data['annotators']];
        annotators.sort();

        //determine who annotated the labels
        labelSchema[i]['labels'].forEach((d) => {
            if (d != "placeHolder") {
                let annotatedUsers = [];
                if (d['label_type'] == 1) {
                    annotators.forEach((u) => {
                        if (parseInt(data['annotations'][u][d['label_id']]) == 1) {
                            annotatedUsers.push(u);
                        }
                    })
                }
                else if (d['label_type'] == 2) {
                    annotators.forEach((u) => {
                        if (data['annotations'][u][d['label_parent']] == d['label_id']) {
                            annotatedUsers.push(u);
                        }
                    })
                }
                d['annotatedUsers'] = annotatedUsers;
            }
        })

        categoryRow.selectAll("label-icon")
            .data(labelSchema[i]['labels'])
            .join("div")
            .attr("class", "col-icon col-1")
            .on("mouseenter", function(event, d){
                if(d != 'placeHolder'){
                    let tooltipHTML = `<div class="icon-tooltip">${d['label_name']}</div>`;
                    $(this).after(tooltipHTML);
                    let tooltipWidth = $('.icon-tooltip').width();
                    let divWidth = $(this).width();
                    let iconLeft = $(this).position().left;
                    let windowWidth = $( window ).width();
                    let left = 0;
                    let top = $(this).position().top - 50;
                    if(iconLeft <= tooltipWidth / 2){
                        //the icon is at the left of the window and cannot shown completely
                        left = $(this).position().left;
                        $('.icon-tooltip').addClass("icon-tooltip-left");
                    }
                    else if(iconLeft + tooltipWidth / 2 > windowWidth){
                        left = $(this).position().left - tooltipWidth + divWidth / 2;
                        $('.icon-tooltip').addClass("icon-tooltip-right");
                    }
                    else{
                        left = $(this).position().left - tooltipWidth / 2 + divWidth / 2 - 4;
                        $('.icon-tooltip').addClass("icon-tooltip-center");
                    }
                    
                    $(this).next().css('left', left);
                    $(this).next().css('top', top);
                }
            })
            .on("mouseleave", function(event, d){
                event.stopPropagation();
                d3.selectAll('.icon-tooltip').remove();
            })
            .append("img")
            .attr("id", function (d) {
                if (d == 'placeHolder') {
                    return data['image_id'] + '-' + category_id;
                }
                else {
                    return data['image_id'] + '-' + d['label_id'];
                }
            })
            .attr("class", function (d) {
                if (d == 'placeHolder') {
                    return "label-icon-placeHolder";
                }
                else {
                    return data['image_id'] + '-' + labelDict[d['label_id']]['label_parent'] + " label-icon";
                }

            })
            .attr("src", function (d, i) {
                if (d == 'placeHolder') {
                    if(i == 0){
                        return checkCategoryConsistency(labels, data['annotations']);
                    }
                    else{
                        return '../static/images/icons/placeHolder.png';
                    }
                    
                }
                else {
                    return labelIcons[d['label_id']];
                }
            })
            .attr("annotatedUsers", function (d) {
                if (d != 'placeHolder') {
                    return d.annotatedUsers.join('-');
                }
                else {
                    return "";
                }
            })
            .style("border-top", function (d) { return "solid 3px " + getBorderColors(d, d.annotatedUsers, annotators, 0) })
            .style("border-bottom", function (d) { return "solid 3px " + getBorderColors(d, d.annotatedUsers, annotators, 0) })
            .style("border-left", function (d) { return "solid 3px " + getBorderColors(d, d.annotatedUsers, annotators, 1) })
            .style("border-right", function (d) { return "solid 3px " + getBorderColors(d, d.annotatedUsers, annotators, 1) })
            // .style("box-shadow", function (d) {
            //     return 'inset 0px 3px 0px ' + getBorderColors(d, d.annotatedUsers, annotators, 0) + ',' +
            //         'inset 0px -3px 0px ' + getBorderColors(d, d.annotatedUsers, annotators, 0) + ',' +
            //         'inset 3px 0px 0px ' + getBorderColors(d, d.annotatedUsers, annotators, 1) + ',' +
            //         'inset -3px 0px 0px ' + getBorderColors(d, d.annotatedUsers, annotators, 1);
            // })
            .on('click', function (event, d) {
                /**
                 * click event for the icons
                 * 1. check if the current user is valid
                 * 2. check the current status, update the database
                 * 3. update the border color
                 * 4. update the background icon (not required)
                 * 5. check the consistency indicator 
                 */
                if (d != 'placeHolder') {
                    let queryAnnotators = findActiveTags('check-user', false);

                    if (queryAnnotators.includes(username) == true) {
                        let currentAnnotators = this.getAttribute('annotatedUsers').split('-'); //who selected this tag now
                        //console.log(username, currentAnnotators);
                        removeArrayElement(currentAnnotators, '');
                        //if the current user select this label, cancel it
                        if (currentAnnotators.includes(username)) {
                            if (d['label_type'] == 1) {
                                //1. annotate the image
                                updateLabel(username, data['image_id'], d['label_id'], 0, 'int');
                                //2. update the annotatedUsers attribute
                                removeArrayElement(currentAnnotators, username);
                                d3.select(this).attr("annotatedUsers", currentAnnotators.join('-'));
                                //3. update icon style
                                updateIconStyles(this, currentAnnotators, annotators);
                                //4. update the consistency indicator
                                let category = labelDict[d3.select(this).attr("id").split('-')[1]]['label_parent'];
                                updateCategoryConsistency(category, data['image_id']);
                            }
                            else if (d['label_type'] == 2) {
                                //if the current icon was selected, we don't need to cancel it since this is a radio icon.
                            }
                        }
                        else {//otherwise, annotate this image
                            if (d['label_type'] == 1) {
                                updateLabel(username, data['image_id'], d['label_id'], 1, 'int');
                                currentAnnotators.push(username);
                                d3.select(this).attr("annotatedUsers", currentAnnotators.join('-'));
                                updateIconStyles(this, currentAnnotators, annotators);
                                let category = labelDict[d3.select(this).attr("id").split('-')[1]]['label_parent'];
                                updateCategoryConsistency(category, data['image_id']);
                            }
                            else if (d['label_type'] == 2) {
                                updateLabel(username, data['image_id'], d['label_parent'], d['label_id'], 'str');
                                //reset the annotatedUsers attribute and borders of all labels in the given category
                                removeAnnotationsByLabels(labels, data['image_id'], annotators);
                                currentAnnotators.push(username);
                                d3.select(this).attr("annotatedUsers", currentAnnotators.join('-'));
                                updateIconStyles(this, currentAnnotators, annotators);
                                let category = labelDict[d3.select(this).attr("id").split('-')[1]]['label_parent'];
                                updateCategoryConsistency(category, data['image_id']);

                            }



                        }

                    }
                    else {
                        showAlert('Please note that since you are not the originally assigned annotator of this image, directly clicking to modify the annotation results is not allowed.');
                    }
                }


            });

        d3.select("#" + divID)
            .append("hr")

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
    Object.keys(labelIcons).forEach((label_id) => {
        if (labelDict[label_id].label_icon_url != '') {
            labelIcons[label_id] = labelDict[label_id].label_icon_url;
        }
    })

}


async function initSchema() {
    let schemaData = await getLabelSchema();
    labelSchema = schemaData['hierarchical_schema'];
    labelSchema = filllabelSchema(labelSchema);
    labelDict = schemaData['schema'];
    labelSchemaList = schemaData['schema_list'];

}

/**
 * fill the long label schema with placeholder
 */
function filllabelSchema(s) {
    s.forEach(d => {
        if (d.labels.length > 12) {
            d.labels.splice(12, 0, "placeHolder");
        }
    })
    return s;
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

