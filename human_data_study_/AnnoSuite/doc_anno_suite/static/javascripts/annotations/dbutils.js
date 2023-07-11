/**
     * 
     * @param {*} image_id 
     * @returns 
     */
function getAnnotationInfo(image_id) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../get_annotation_info',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
     * 
     * @param {*} image_id 
     * @returns 
     */
 function getBBoxAnnotationInfo(image_id) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../get_bbox_annotation_info',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * update the log of annotation
 * @param {*} username 
 * @param {*} image_id 
 * @param {*} log 
 * @returns 
 */
function updateAnnotationLog(username, image_id, log) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id, 'username': username, 'log': log };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_annotation_log',
            dataType: 'JSON',
            success: function (data) {
                if (data.status == 0) {
                    console.log("record not founded!");
                }
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * update the user progreass
 * @param {*} username 
 * @param {*} currentIndex 
 * @returns 
 */
function updateUserProgress(username, anno_index) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'username': username, 'anno_index': anno_index };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_user_progress',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * only used for getting the navigator information
 * @param {*} image_id 
 * @param {*} navigator_meta 
 * @returns 
 */
function updateImageNavigatorMeta(image_id, navigator_meta) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id, 'navigator_meta': navigator_meta };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_image_captionurl',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}


/**
 * update the user progreass
 * @param {*} username 
 * @param {*} currentIndex 
 * @returns 
 */
 function updateUserBBoxProgress(username, anno_index) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'username': username, 'anno_index': anno_index };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_user_bbox_progress',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * update the label of a specific image, ignore the username
 * i.e. apply to all users
 * @param {*} username 
 * @param {*} image_id 
 * @param {*} label_id 
 * @param {*} value: the new value of label_id
 * @param {*} type: the type of this label: str | int | float | datetime
 * @returns 
 */
function updateLabelAll(username, image_id, label_id, value, type) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id, 'username': username, 'label_id': label_id, 'value': value, 'type': type };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_label_all',
            dataType: 'JSON',
            success: function (data) {
                if (data.status == 0) {
                    console.log("record not founded!");
                }
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * update the label of a specific image annotated by a user
 * i.e. only apply to one annotation record
 * @param {*} username 
 * @param {*} image_id 
 * @param {*} label_id 
 * @param {*} value 
 * @param {*} type 
 * @returns 
 */
function updateLabel(username, image_id, label_id, value, type) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id, 'username': username, 'label_id': label_id, 'value': value, 'type': type };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_label',
            dataType: 'JSON',
            success: function (data) {
                if (data.status == 0) {
                    console.log("record not founded!");
                }
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * update the tracker field
 * @param {*} username 
 * @param {*} image_id 
 * @param {*} value 
 * @returns 
 */
function updateTrackerData(username, image_id, value) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_id': image_id, 'username': username, 'value': value };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../update_tracker_data',
            dataType: 'JSON',
            success: function (data) {
                if (data.status == 0) {
                    console.log("record not founded!");
                }
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * get n distinct colors
 * @param {*} n 
 * @returns 
 */
function getDistinctUserColor() {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            url: '../../get_distinct_user_colors',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

function getDistictLabelColors() {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            url: '../../get_distict_label_colors',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * 
 * @returns 
 */
function getLabelSchema() {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            url: '../../get_label_schemas',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

function getLabelIcons() {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            url: '../../get_label_icons',
            dataType: 'JSON',
            success: function (data) {
                resolve(data.icons);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}

/**
 * given the screenshot, return the annotation results
 */
function queryAnnotation(screenshot) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'query_condition': screenshot };
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../query_annotation',
            dataType: 'JSON',
            success: function (data) {
                resolve(data.res);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });

}

/**
 * only used for the AI mode
 * @param {*} image_url 
 * @returns 
 */
 function getPredictBox(image_url) {
    return new Promise((resolve, reject) => {
        var dataJSON = { 'image_url': image_url};
        $.ajax({
            type: "POST",
            data: dataJSON,
            url: '../../get_predict_bbox',
            dataType: 'JSON',
            success: function (data) {
                resolve(data);
            },
            error: function (data) {
                console.log(data);
                reject(data);
            }
        });
    });
}


