
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

$(".btn-close").click(function () {
    let targetDiv = $(this).attr('target-div');
    $('#'+targetDiv).css({ 'display': 'none' });
});

/**
 * remove element from array by value
 * e.g. removeArrayElement(ary, 'seven');
 * @param {*} arr 
 * @returns 
 */
function removeArrayElement(arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax= arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

/**
     * get the image meta such as width and height
     * @param {*} url 
     * @returns 
     */
 function getFigureMeta(url) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject();
        img.src = url;
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}