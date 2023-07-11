(function () {

    var username;
    var image_id;
    var annotationData;
    var imageCount;
    var assignment;
    var currentIndex;
    var dbIndex; //recent progress in db
    var labelDict;

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
            if (url_image_id != 'None') { info = await getAnnotationInfo(url_image_id); }
            else { info = await getAnnotationInfo(''); }

            annotationData = info['current_annotation_info'][0];
            username = info.current_username;
            image_id = info.current_user_image_id;
            assignment = info.current_user_assignment.split(';')
            currentIndex = assignment.indexOf(image_id);
            dbIndex = info.current_user_progress;
            imageCount = assignment.length;

            //console.log(info);

            //record the login time
            let log = username + ':' + 'login';
            //console.log(username, image_id, log);
            await updateAnnotationLog(username, image_id, log);

            let schemaData = await getLabelSchema();
            labelDict = schemaData['schema'];

            //console.log(labelDict);

            showAnnotationResults(annotationData);
            imageAnnotation();
            annotationControl();

        }

    });



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
    }

    /**
     * init the image
     * @param {*} data 
     */
    function initImage(data) {
        $('#vis-img').attr("src", data['image_url']);

        //magnify image
        $('#BlowupLens').remove();
        $("#vis-img").blowup({
            "round": false,
            "border": "3px solid #636e72",
            "scale": 4,
            "width": 350,
            "height": 350,
            "background": '#fff'
        });

        $(window).resize(function () {
            $('#BlowupLens').remove();
            $("#vis-img").blowup({
                "round": false,
                "border": "3px solid #636e72",
                "scale": 4,
                "width": 350,
                "height": 350,
                "background": '#fff'
            });
        });
    }

    /**
     * initialize the annotation buttons
     * @param {*} data 
     */
    function initAnnotation(data) {
        //reset style
        removeFeedback();
        //init check
        $('.check-label').each(function () {
            let label_id = this.id;
            if (parseInt(data[label_id]) == 1) {
                $('#' + label_id).prop("checked", true);
            }
            else {
                $('#' + label_id).prop("checked", false);
            }
        });
        //init radio
        $('.radio-label').each(function () {
            let label_id = this.id;
            let parent_id = $(this).attr('name');
            if (data[parent_id] == label_id) {
                $('#' + label_id).prop("checked", true);
            }
            else {
                $('#' + label_id).prop("checked", false);
            }
        });
        //init text-label
        $('.text-label').each(function () {
            let label_id = this.id;
            $(this).val(data[label_id]);
        });
    }



    /**
     * present the annotation results from db to the interface
     */
    function showAnnotationResults(data) {

        $('#index-label').text((currentIndex + 1) + '/' + imageCount);
        initWidgets(data);
        initImage(data);
        initAnnotation(data);
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
     * annotation images
     */
    function imageAnnotation() {
        //1. type 1 tag annotation
        $(".check-label").click(async function () {
            let label_id = this.id;
            if ($('#' + label_id).is(":checked")) {
                await updateLabel(username, image_id, label_id, 1, 'int');
            } else {
                await updateLabel(username, image_id, label_id, 0, 'int');
            }
        });
        //2. type 2 radio annotation
        $(".radio-label").click(async function () {
            let label_id = this.id;
            let parent_label = $(this).attr('name');
            await updateLabel(username, image_id, parent_label, label_id, 'str');
        });
        //3. type 3 text annotation 
        $('#savecomment').unbind('click').click(function () { });
        $("#savecomment").click(function () {
            saveTextLabels();
        });
    }


    async function saveTextLabels() {

        let validateText = true;

        $('.text-label').each(async function () {
            let text = $(this).val();
            if (text.includes(';') || text.includes(":")) {
                validateText = false;
            }
        });

        if(validateText){
            $('.text-label').each(async function () {
                let label_id = this.id;
                let text = $(this).val();
                await updateLabel(username, image_id, label_id, text, 'str');
                showFeedback();
                await sleep(500);
                removeFeedback();
            });
        }
        else{
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
     * present the alert information
     * @param {*} msg 
     */
    async function showAlert(msg) {
        $('#danger-alert-text').text(msg);
        $('#danger-alert').css({ 'display': 'block' });
        await sleep(3000);
        $('#danger-alert').css({ 'display': 'none' });
    }

    function removeAlert(msg) {
        $('#danger-alert').css({ 'display': 'none' });
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
        Object.keys(labelDict).forEach((label_id) => {
            let label_name = labelDict[label_id]['label_name'];
            if (labelDict[label_id]['label_isrequired'] == 1) {
                categoryDic[label_id] = label_name;
                categories.push(label_id);
            }
        });
        for (let i = 0; i < categories.length; i++) {
            let status = checkCategory(categories[i]);
            if (status == false) {
                validateAnnotation = false;
                showAlert('Please select at least one ' + categoryDic[categories[i]]);
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

        $('#previous').unbind('click').click(function () { });
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

        $('#next').unbind('click').click(function () { });
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
                    $('#vis-img').css("display", 'none');
                    $('#AnnoPanel').css("display", 'none');
                    $('#paper-meta-info').css("display", 'none');
                    $('#mark-error-box').css("display", 'none');
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
                let index_text = $('#image-index-text').val();
                if (index_text != '') {
                    if (index_text >= 1 && index_text <= imageCount) {
                        let nextImageID = assignment[index_text - 1];
                        window.location.href = "/annotate?image_id=" + nextImageID;
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

        let info = await getAnnotationInfo(image_id);
        dbIndex = info.current_user_progress;
        annotationData = info['current_annotation_info'][0];
        let log = username + ':' + 'login';
        await updateAnnotationLog(username, image_id, log);
        showAnnotationResults(annotationData);
    }

    /**
     * show annotation feedback by highlight the button
     */
    function showFeedback() {
        $('.btn-check').each(async function () {
            let label_id = this.id;
            if ($('#' + label_id).is(":checked")) {
                $('#' + label_id + '-label').addClass('feedback');
            }
        });
        $('.text-label').each(async function () {
            let label_id = this.id;
            if ($(this).val() != '') {
                $('#' + label_id).addClass('feedback');
            }
        });
    }

    function removeFeedback() {
        $('.btn-check').each(async function () {
            $('#' + this.id + '-label').removeClass('feedback');
        });
        $('.text-label').each(async function () {
            $('#' + this.id).removeClass('feedback');
        });
    }


})();

