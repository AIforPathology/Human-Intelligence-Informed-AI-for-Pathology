from distutils.log import debug
from socket import socket
from doc_anno_suite import create_app
from flask_socketio import SocketIO, emit
import tobii_research as tr
import math

# eye tracker
eyetracker_enabled = False

if eyetracker_enabled:
    found_eyetrackers = tr.find_all_eyetrackers()
    my_eyetracker = found_eyetrackers[0]
    print(my_eyetracker.device_name + " is ready")
else:
    print("eye tracker is disabled now")

app, socketio = create_app()

def test_connect():
    emit('my_response', {'data': 'Connected'})

if __name__ == '__main__':
    #app.run(debug=True)

    def gaze_data_callback(gaze_data):
        # Print gaze points of left and right eye
        # print(gaze_data['left_gaze_point_on_display_area'])
        
        if math.isnan(gaze_data['left_gaze_point_on_display_area'][0]) == False and math.isnan(gaze_data['right_gaze_point_on_display_area'][0]) == False:
            socketio.emit('gazepos', {'gazepos': [gaze_data['left_gaze_point_on_display_area'][0],gaze_data['left_gaze_point_on_display_area'][1],\
                gaze_data['right_gaze_point_on_display_area'][0],gaze_data['right_gaze_point_on_display_area'][1], gaze_data['system_time_stamp']]})

    def user_position_callback(eye_data):
        if math.isnan(eye_data['left_user_position'][0]) == False and math.isnan(eye_data['right_user_position'][0]) == False:
             socketio.emit('eyepos', {'eyepos': [ eye_data['left_user_position'][0], eye_data['left_user_position'][1], eye_data['left_user_position'][2], \
                 eye_data['right_user_position'][0], eye_data['right_user_position'][1], eye_data['right_user_position'][2] ]})

    # eye openness is not supported in Tobii pro
    # def eye_openness_callback(openness_data):
    #     print(openness_data)

    @socketio.on('connect')
    def test_connect():
        emit('my_response', {'data': 'Connected'})

    @socketio.on('my_event')
    def my_event(msg):
        #emit('my_response', {'data': msg})
        if msg['data'] == 'begin_eye_tracking':
            emit('my_response', {'data': 'begin from python'})
            my_eyetracker.subscribe_to(tr.EYETRACKER_GAZE_DATA, gaze_data_callback, as_dictionary=True)
            my_eyetracker.subscribe_to(tr.EYETRACKER_USER_POSITION_GUIDE, user_position_callback, as_dictionary=True)
        elif msg['data'] == 'end_eye_tracking':
            emit('my_response', {'data': 'end from python'})
            my_eyetracker.unsubscribe_from(tr.EYETRACKER_GAZE_DATA, gaze_data_callback)
            my_eyetracker.unsubscribe_from(tr.EYETRACKER_USER_POSITION_GUIDE, user_position_callback)
    
    
    socketio.run(app, debug=True)