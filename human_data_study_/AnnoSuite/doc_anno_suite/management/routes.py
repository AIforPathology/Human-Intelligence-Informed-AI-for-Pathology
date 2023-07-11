from flask import Blueprint
from flask import render_template, flash, redirect, request, send_from_directory, url_for
from flask import current_app
from doc_anno_suite.management.dbimport import ImageLoader, SchemaLoader, UserLoader, AnnotationGenerator, AnnotationExporter, AnnotationLoader, ZipFileLoader, DBUtils, ProgressSimulator
from flask_login import login_required
from werkzeug.utils import secure_filename
import os

management = Blueprint('management', __name__)

data_load = {'image_data': '', 'user_data': '',
             'label_schema': '', 'anno_res': ''}

@management.route("/admin")
@login_required
def admin():
    #check if the current project is a new project
    is_ready, msg = DBUtils.check_input_data()
    return render_template('admin.html', title='Admin Panel', preload=data_load, is_ready = is_ready)

@management.route("/upload_new_project", methods=['GET', 'POST'])
def upload_new_project():
    annotation_exporter = AnnotationExporter('backup.zip')
    annotation_exporter.backup_database()
    f = request.files['file']
    if(f.filename.endswith('.zip')):
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(f.filename))
        f.save(file_path)
        # reset the database
        DBUtils.reset_whole_database()
        ziploader = ZipFileLoader(f.filename)
        load_status, load_msg = ziploader.load_zip_file()
        if(load_status):
            flash('Project successfully set up!', 'success')
        else:
            flash(load_msg[0], 'danger')
    else:
        flash('The file type is not correct. Please upload a .zip file instead!', 'danger')
    return redirect(request.referrer)



@management.route("/update_project", methods=['GET', 'POST'])
def update_project():
    if request.method == 'POST':
        annotation_exporter = AnnotationExporter('backup.zip')
        annotation_exporter.backup_database()
        f = request.files['file']
        if(f.filename.endswith('.zip')):
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(f.filename))
            f.save(file_path)
            ziploader = ZipFileLoader(f.filename)
            load_status, load_msg = ziploader.load_zip_file()
            if(load_status):
                flash('Project successfully updated!', 'success')
            else:
                flash(load_msg[0], 'danger')
        else:
            flash('The file type is not correct. Please upload a .zip file instead!', 'danger')
        return redirect(request.referrer)
        
# https://stackoverflow.com/questions/24577349/flask-download-a-file
@management.route('/export_annotation_data', methods=['GET', 'POST'])
def export_annotation_data():
    file_path = current_app.config['UPLOAD_FOLDER']
    filename = os.path.join(current_app.config['UPLOAD_FOLDER'], 'results.zip')
    annotation_exporter = AnnotationExporter(filename)
    load_status, load_msg = annotation_exporter.export_annotation_to_csv()
    if(load_status):
        #return send_from_directory(directory=file_path, filename='results.zip', as_attachment=True) # before 2.0
        return send_from_directory(directory=file_path, path='results.zip', as_attachment=True) # after 2.0
    else:
        flash(load_msg[0], 'danger')
        return redirect(request.referrer)

# upload modules
# https://pythonbasics.org/flask-upload-file/
@management.route("/upload_image_data", methods=['GET', 'POST'])
def upload_image_data():
    if request.method == 'POST':
        f = request.files['file']
        #print(f.filename)
        if(f.filename == ''):
            flash('No file choosen!', 'danger')
        else:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(f.filename))
            f.save(file_path)
            data_load['image_data'] = f.filename
            imageloader = ImageLoader(file_path)
            load_status, load_msg = imageloader.load_image_data()
            if(load_status):
                flash('File successfully imported', 'success')
            else:
                flash(load_msg[0], 'danger')
        return redirect(request.referrer)


@management.route("/upload_user_data", methods=['GET', 'POST'])
def upload_user_data():
    if request.method == 'POST':
        f = request.files['file']
        if(f.filename == ''):
            flash('No file choosen!', 'danger')
        else:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(f.filename))
            f.save(file_path)
            data_load['user_data'] = f.filename
            userloader = UserLoader(file_path)
            load_status, load_msg = userloader.load_user_data()
            if(load_status):
                flash('File successfully imported', 'success')
            else:
                flash(load_msg[0], 'danger')
        return redirect(request.referrer)


@management.route("/upload_label_schema", methods=['GET', 'POST'])
def upload_label_schema():
    if request.method == 'POST':
        f = request.files['file']
        if(f.filename == ''):
            flash('No file choosen!', 'danger')
        else:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(f.filename))
            f.save(file_path)
            data_load['label_schema'] = f.filename
            schemaloader = SchemaLoader(file_path)
            load_status, load_msg = schemaloader.load_schema_data()
            if(load_status):
                flash('File successfully imported', 'success')
            else:
                flash(load_msg[0], 'danger')
        return redirect(request.referrer)


@management.route("/upload_annotation_results", methods=['GET', 'POST'])
def upload_annotation_results():
    if request.method == 'POST':
        f = request.files['file']
        if(f.filename == ''):
            flash('No file choosen!', 'danger')
        else:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], secure_filename(f.filename))
            f.save(file_path)
            data_load['label_schema'] = f.filename
            schemaloader = SchemaLoader(file_path)
            load_status, load_msg = schemaloader.load_schema_data()
            if(load_status):
                flash('File successfully imported', 'success')
            else:
                flash(load_msg[0], 'danger')
        return redirect(request.referrer)

@management.route("/generate_anno_table", methods=['GET', 'POST'])
def generate_anno_table():
    if request.method == 'GET':
        annotation_generator = AnnotationGenerator()
        status, msg = annotation_generator.generate_annotation_table()
        if(status):
            return {'status': 1, 'msg': ''}
        else:
            return {'status': 0, 'msg': msg[0]}



@management.route('/download_samples', methods=['GET', 'POST'])
def download_samples():
    file_path = current_app.config['UPLOAD_FOLDER']
    return send_from_directory(directory=file_path, filename='samples.zip', as_attachment=True)

@management.route('/reset_database', methods=['GET', 'POST'])
def reset_database():
    DBUtils.reset_whole_database()
    return redirect(request.referrer)


### only for testing now, experimental features
@management.route("/get_work_progress", methods=['GET', 'POST'])
def get_work_progress():
    if request.method == 'GET':
        progress = ProgressSimulator.get_progress()
        return {'progress': progress}

### only for testing now, experimental features
@management.route("/export_simulation_results", methods=['GET', 'POST'])
def export_simulation_results():
    if request.method == 'GET':
        res = ProgressSimulator.server_work()
        return {'res': res}

@management.route("/reset_work_progress", methods=['GET', 'POST'])
def reset_work_progress():
    if request.method == 'GET':
        ProgressSimulator.reset_progress()
        return {'progress': 0}