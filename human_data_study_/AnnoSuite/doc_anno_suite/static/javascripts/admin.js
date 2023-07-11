$(document).ready(function () {

    let reset_progress = function(){
        $('.progress').css("visibility", "hidden");
        $('#progressbar').css("width", 0 + "%");
        $('#progressbar').text(0 + "%");
        $.ajax({
            type: "GET",
            url: '../../reset_work_progress',
            dataType: 'JSON',
            success: function (data) {
            
            },
            error: function (data) {
                console.log(data);
            }
        });
    }

    reset_progress();

    //new project check
    $("#new_project_btn").change(function() {
        //check weather the project has been setted up
        if(parseInt(is_ready) == 1){
            $('#new-proj-check').modal('show');
        }
        else{
            $('#new_project_form').submit();
            progress();
            $('#new_project_btn').prop("value", "");
        }
    });

    $('#new-proj-submit').click(function(){
        $('#new_project_form').submit();
        progress();
        $('#new_project_btn').prop("value", "");
    });

    $('#new-proj-cancel').click(function(){
        $('#new_project_btn').prop("value", "");
    });

    
    //update project checking
    $("#update_project_btn").change(function() {
        $('#update-proj-check').modal('show');
    });

    $('#update-proj-submit').click(function(){
        $('#update_project_form').submit();
        progress();
        $('#update_project_btn').prop("value", "");
    });

    $('#update-proj-cancel').click(function(){
        $('#update_project_btn').prop("value", "");
    });

    //export results
    $('#export_data_btn').click(function(event){
        event.preventDefault();
        $('#export_data_form').submit();
        progress();
    })


    //testing simulation function
    $('.progress-form').on('submit', function(event){
        event.preventDefault();
    })

    let simulation = function(){
        $.ajax({
            type: "GET",
            url: '../../export_simulation_results',
            dataType: 'JSON',
            success: function (data) {
                console.log(data);
            },
            error: function (data) {
                console.log(data);
            }
        });
    };
    var progressMonitor = null;
    let progress = function(){
        $('.progress').css("visibility", "visible");
        progressMonitor = setInterval(function(){
            $.ajax({
                type: "GET",
                url: '../../get_work_progress',
                dataType: 'JSON',
                success: function (data) {
                    $('#progressbar').css("width", data.progress + "%");
                    $('#progressbar').text(data.progress + "%");
                    if(data.progress == 100){
                        console.log("finished!");
                        reset_progress();
                        clearInterval(progressMonitor);
                    }
                },
                error: function (data) {
                    console.log(data);
                }
            });
        }, 100);
    }

    

    $('#export_simulate').click(function(){
        //call the export function
        simulation();
        progress();

    })

    


    


});

