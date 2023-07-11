'''
import database from data file
validate the data file
'''
from os import stat
import pandas as pd
from sqlalchemy.sql.elements import Label
from sqlalchemy.sql.functions import user
from doc_anno_suite.database import engine
from doc_anno_suite.models import User, Image, Schema, Annotation
from doc_anno_suite.annotations.dbutils import DatabaseCRUD
from doc_anno_suite.database import db_session
from doc_anno_suite import bcrypt
from collections import Counter
import zipfile
from flask import current_app
import os
import shutil
from datetime import datetime
import time
import numpy as np

#only for testing progress bar
server_progress = [0]

class ProgressSimulator():
    '''
    This is an experiment function to simular the progress
    http://elfga.com/articles/bootstrap-progress-bar-update-jqueryajax/
    https://stackoverflow.com/questions/27035867/how-to-dynamically-update-progress-bar-while-doing-database-query-with-delay-of
    https://cloud.tencent.com/developer/article/1555235
    https://www.youtube.com/watch?v=f-wXTpbNWoM

    idea: front end, click download button.
    这时使用一个ajax调用后台的export函数
    然后使用第二个ajax循环调用后台的get progress函数，并更新progress bar，当progress = 99%的时候停止调用clear interval
    此时理论上第一个ajax应该已经完成
    '''

    def server_work():
        '''
        finish in 5 seconds
        '''
        i = 0
        while i < 100:
            i = i + 1
            server_progress[0] = i
            time.sleep(0.05)
        return "results"

    @staticmethod
    def get_progress():
        return server_progress[0]

    @staticmethod
    def reset_progress():
        server_progress[0] = 0

class Utils():

    @staticmethod
    def createTableDicByData(dicID, data):
        dataDic = {}
        column_list = data.columns.values.tolist()
        for i in range(len(data)):
            dataID = str(data.loc[i,dicID])
            if(dataID in dataDic):
                dataInfo = {}
                for key in column_list:
                    dataInfo[key] = data.loc[i,key]
                dataDic[dataID].append(dataInfo)
            else:
                dataInfo = {}
                for key in column_list:
                    dataInfo[key] = data.loc[i,key]
                dataDic[dataID] = [dataInfo]
        return dataDic 

    @staticmethod
    def createTableDicTwoByData(dicID1, dicID2, data):
        dataDic = {}
        column_list = data.columns.values.tolist()
        for i in range(len(data)):
            dataID1 = data.loc[i,dicID1]
            dataID2 = data.loc[i,dicID2]
            dataID = str(dataID1) + '-' + str(dataID2)
            if(dataID in dataDic):
                dataInfo = {}
                for key in column_list:
                    dataInfo[key] = data.loc[i,key]
                dataDic[dataID].append(dataInfo)
            else:
                dataInfo = {}
                for key in column_list:
                    dataInfo[key] = data.loc[i,key]
                dataDic[dataID] = [dataInfo]
        return dataDic 

class DBUtils():
    @staticmethod
    def reset_database(db_name):
        '''
        need to update based on the using database
        '''
        #sql_str = "TRUNCATE TABLE " + db_name
        sql_str = "DELETE FROM " + db_name
        with engine.connect() as conn:
            res = conn.execute(sql_str)
        # if(db_name == 'annotation'):
        #     User.query.filter_by(is_admin=0).delete()

    @staticmethod
    def reset_user():
        User.query.filter_by(is_admin=0).delete()
        db_session.commit()
        admin_user = User.query.filter_by(is_admin=1).first()
        admin_user.assignment = ''
        admin_user.anno_index = 0
        db_session.commit()

    @staticmethod
    def reset_whole_database():
        DBUtils.reset_database('annotation')
        DBUtils.reset_user()
        DBUtils.reset_database('image')
        DBUtils.reset_database('schema')

    @staticmethod
    def check_input_data():
        is_ready = 1
        error_msg = []
        if not Annotation.query.first():
            is_ready = 0
            error_msg.append('Please set up the annotation project first!')
        return is_ready, error_msg

class ZipFileLoader():
    def __init__(self, filename):
        self.filename = filename
        self.image_name = 'images.csv'
        self.user_name = 'users.csv'
        self.schema_name = 'label_schema.csv'
        self.annotation_name = 'annotations.csv'

    @staticmethod
    def unzip_file(filename):
        '''
        1. remove "inputs" folder
        2. create a "inputs" folder
        3. extract contents to the "inputs" folder
        '''
        filename = filename.replace(' ','_')
        path = current_app.config['UPLOAD_FOLDER'] + '/inputs'
        if(os.path.isdir(path)):
            shutil.rmtree(path)
        os.mkdir(path)
        zip_file = zipfile.ZipFile(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
        with zipfile.ZipFile(os.path.join(current_app.config['UPLOAD_FOLDER'], filename), 'r') as zip_ref:
            zip_ref.extractall(path)

    def validate_filenames(self):
        '''
        1. if the directory exists, check files in the directory
        2. otherwise, check files directly
        '''
        filename_validate = True
        validation_message = []
        file_path_dict = {}
        filelist = [self.image_name, self.schema_name, self.user_name]
        path = current_app.config['UPLOAD_FOLDER'] + '/inputs/'
        for filename in filelist:
            find_file = False
            for dir, sub_dirs, files in os.walk(path):
                if(filename in files):
                    find_file = True
                    file_path_dict[filename] = dir + '/' + filename
            if(find_file == False):
                filename_validate = False
                validation_message.append("The " + filename + " is not exist!")
        '''
        deal with the annotation.csv individually since this an optional file
        '''
        for filename in [self.annotation_name]:
            for dir, sub_dirs, files in os.walk(path):
                if(filename in files):
                    file_path_dict[filename] = dir + '/' + filename
        return filename_validate, validation_message, file_path_dict

    def import_data(self, file_path_dict):
        dataimport_validate = True
        dataimport_message = []
        #import three mandatory inputs
        imageloader = ImageLoader(file_path_dict[self.image_name])
        load_status, load_msg = imageloader.load_image_data()
        if(load_status == False):
            return load_status, load_msg

        server_progress[0] = 65

        userloader = UserLoader(file_path_dict[self.user_name])
        load_status, load_msg = userloader.load_user_data()
        if(load_status == False):
            return load_status, load_msg

        server_progress[0] = 70

        schemaloader = SchemaLoader(file_path_dict[self.schema_name])
        load_status, load_msg = schemaloader.load_schema_data()
        if(load_status == False):
            return load_status, load_msg

        server_progress[0] = 75

        if self.annotation_name in file_path_dict:
            annotationloader = AnnotationLoader(file_path_dict[self.annotation_name])
            #load_status, load_msg = annotationloader.load_annotation_data_raw()
            load_status, load_msg = annotationloader.load_annotation_data(file_path_dict[self.schema_name])
            if(load_status == False):
                return load_status, load_msg
        else:
            annotation_generator = AnnotationGenerator()
            status, msg = annotation_generator.generate_annotation_table()
            if(status == False):
                return status, msg

        server_progress[0] = 99

        #update the progress
        UserLoader.update_user_progress()
        
        return dataimport_validate, dataimport_message

    @staticmethod
    def check_zip_file_name(filename):
        if ' ' in filename:
            return False, "' ' can't be used in the input filename!"


    def load_zip_file(self):
        '''
        load the image data to the database
        1. check if the unzipped file contains correct filenames
        2. import each file sequentially
        3. if all import process succeed, generate the database
        '''
        server_progress[0] = 5
        ZipFileLoader.unzip_file(self.filename)
        server_progress[0] = 10
        filename_validate, validation_message, file_path_dict = self.validate_filenames()
        if(filename_validate == False):
            return False, validation_message
        dataimport_validate, dataimport_message = self.import_data(file_path_dict)
        if(dataimport_validate == False):
            return False, dataimport_message
        server_progress[0] = 100

        return True, []

class ImageLoader():

    def __init__(self, filename):
        self.filename = filename

    @staticmethod
    def validate_file_type(filename):
        '''
        check whether the current file is a csv file
        '''
        if(filename.endswith('.csv')):
            return True, []
        else:
            return False, ['The file type is not correct. Please upload a .csv file instead!']

    @staticmethod
    def validate_file_schema(filename):
        '''
        check if the current file contains all mandatory columns/fields
        '''
        schema_validate = True
        validation_message = []
        with open(filename, 'r') as file:
            data_df = pd.read_csv(file, encoding = 'utf-8')
            print(file, data_df.columns)
            if('M_image_id' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_image_id column is missing in the image.csv!')
            if('M_image_name' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_image_name column is missing in the image.csv!')
            if('M_image_url' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_image_url column is missing in the image.csv!')
            if('M_display_order' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_display_order column is missing in the image.csv!')
        return schema_validate, validation_message

    def load_image_data(self):
        '''
        load the image data to the database
        '''
        file_type_validate, file_type_validate_msg = self.validate_file_type(
            self.filename)
        if(file_type_validate == False):
            return False, file_type_validate_msg
        schema_validate, schema_validate_msg = self.validate_file_schema(
            self.filename)
        if(schema_validate == False):
            return False, schema_validate_msg
        DBUtils.reset_database('image')
        with open(self.filename, 'r') as file:
            data_df = pd.read_csv(file, encoding = 'utf-8')
            is_caption_url_provide = 'O_caption_url' in data_df.columns
            is_paper_url_provide = 'O_paper_url' in data_df.columns
            is_year_provide = 'O_year' in data_df.columns
            #rename the columns
            server_progress[0] = 20
            data_length = len(data_df)
            for i in range(len(data_df)):
                server_progress[0] = 20 + int(45 * (i / data_length))
                image_id = data_df.at[i,'M_image_id']
                image_name = data_df.at[i,'M_image_name']
                image_url = data_df.at[i,'M_image_url']
                display_order = int(data_df.at[i,'M_display_order'])
                caption_url = data_df.at[i,'O_caption_url'] if is_caption_url_provide else ''
                paper_url = data_df.at[i,'O_paper_url'] if is_paper_url_provide else ''
                year = int(data_df.at[i,'O_year']) if (is_year_provide) and (not pd.isna(data_df.at[i,'O_year'])) else -1
                image = Image(image_id=image_id, image_name=image_name, image_url = image_url,
                            rank=display_order, caption_url = caption_url, paper_url=paper_url, year = year)
                db_session.add(image)
                db_session.commit()
            return True, []

class UserLoader():

    def __init__(self, filename):
        self.filename = filename

    @staticmethod
    def migrate_user(data):
        '''
        migrate the old database to the new database
        '''
        if not User.query.filter_by(is_admin=0).first():
            for i in range(len(data)):
                data.at[i,'anno_index'] = int(0)
                data.at[i,'anno_bbox_index'] = int(0)
            return data
        else:
            sql_query = pd.read_sql_query(
                '''SELECT * FROM user''', engine)
            old_data = pd.DataFrame(sql_query)
            old_data_dic = Utils.createTableDicByData('username', old_data)
            for i in range(len(data)):
                username = data.at[i,'M_username']
                if(username in old_data_dic):
                    old_record = old_data_dic[username][0]
                    data.at[i,'anno_index'] = old_record['anno_index']
                    data.at[i,'anno_bbox_index'] = old_record['anno_bbox_index']
                    data.at[i,'log'] = old_record['log']
            return data

    @staticmethod
    def update_user_progress():
        '''
        call this function after updating or creating the project
        the basic idea is to find earliest image that has not been annotated.
        1. find the categories that needs to be annotated.
        2. from the user sequence, query the image database and store to a dic
        3. if the categories don't contain any item => there is no required category need to be check
            => we could keep the original index
        '''
        labels = Schema.query.all()
        label_instances = Schema.query.with_entities(Schema.label_id, Schema.label_type, Schema.label_parent, \
            Schema.label_name, Schema.label_abbr, Schema.label_isrequired, Schema.label_icon_url).all()
        label_dict = {label[0] : {'label_type': label[1], 'label_parent': label[2], \
            'label_name': label[3], 'label_abbr': label[4], 'label_isrequired': label[5], 'label_icon_url':label[6]}  for label in label_instances}
        category_dic = {}
        for label in labels:
            if (label.label_parent == 'root') and (int(label.label_isrequired) == 1):
                category_dic[label.label_id] = []
        for label in labels:
            if (label.label_parent != 'root') and (label.label_parent in category_dic):
                category_dic[label.label_parent].append(label.label_id)

        if len(category_dic.keys()) != 0:
            sql = "SELECT image_id, username FROM annotation WHERE "
            for index, category in enumerate(category_dic):
                if(index != 0):
                    sql += ' OR ('
                else:
                    sql += '('
                label_list = category_dic[category]
                for i in range(len(label_list)):
                    label_id = label_list[i]
                    if(int(label_dict[label_id]['label_type']) == 1):
                        if(i == 0):
                            sql = sql + label_id + " = 0"
                        else:
                            sql = sql + ' AND ' + label_id + " = 0"
                    elif(int(label_dict[label_id]['label_type']) == 2):
                        if(i == 0):
                            sql = sql + label_dict[label_id]['label_parent'] +\
                                " = \'\'"
                        else:
                            sql = sql + ' AND ' + label_dict[label_id]['label_parent'] +\
                                " = \'\'"
                    elif(int(label_dict[label_id]['label_type']) == 3):
                        if(i == 0):
                            sql = sql + 'annotation.' + label_id + " == \'\'"
                        else:
                            sql = sql + ' AND ' + label_id + " == \'\'"
                sql += ')'
            sql += " AND is_error_image = 0"
            res = DatabaseCRUD.get_annotation_by_query_condition(sql)
            #print(sql, res)
            if(len(res) != 0):
                user_images_dic = {}
                for record in res:
                    if record['username'] in user_images_dic:
                        user_images_dic[record['username']].append(record['image_id'])
                    else:
                        user_images_dic[record['username']] = [record['image_id']]
                # print(user_images_dic)
                users = User.query.all()
                for user in users:
                    username = user.username
                    if(username in user_images_dic):
                        image_list = user_images_dic[username]
                        assignment = user.assignment.split(';')
                        if(len(assignment) != 0 and len(image_list) != 0):
                            for i in range(len(assignment)):
                                image_id = assignment[i]
                                if(image_id in image_list):
                                    user.anno_index = i
                                    #print("update ", username, " where anno index = ", i)
                                    db_session.commit()
                                    break
                    else:
                        #this user has already annotated all images
                        assignment = user.assignment.split(';')
                        if(len(assignment) != 0):
                            user.anno_index = len(assignment) - 1
                            db_session.commit()

      
    @staticmethod
    def validate_file_type(filename):
        '''
        check whether the current file is a csv file
        '''
        if(filename.endswith('.csv')):
            return True, []
        else:
            return False, ['The file type is not correct. Please upload a .csv file instead!']

    @staticmethod
    def validate_assignments(user_assignments):
        image_occurance = ';'.join(user_assignments).split(';')
        image_counter = Counter(image_occurance)
        for key in image_counter:
            if(image_counter[key] > 2):
                return False
        return True

    @staticmethod
    def validate_file_schema(filename):
        '''
        check if the current file follow the predefined schema
        check username, user_assignments, user_index
        '''
        schema_validate = True
        validation_message = []
        with open(filename, 'r') as file:
            data_df = pd.read_csv(file, encoding = 'utf-8')
            if('M_username' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_username column is missing in the users.csv!')
            if('M_assignment_by_image_id' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_assignment_by_image_id column is missing in the users.csv!')
            # TODO: only comment for the user study 1
            # if('M_assignment_by_image_id' in data_df.columns):
            #     assignment = list(data_df['M_assignment_by_image_id'])
            #     if(UserLoader.validate_assignments(assignment) == False):
            #         schema_validate = False
            #         validation_message.append(
            #             'Each image can only be assigned to at most 2 users!')

        return schema_validate, validation_message

    def load_user_data(self):
        '''
        load the image data to the database
        '''
        file_type_validate, file_type_validate_msg = self.validate_file_type(
            self.filename)
        if(file_type_validate == False):
            return False, file_type_validate_msg
        schema_validate, schema_validate_msg = self.validate_file_schema(
            self.filename)
        if(schema_validate == False):
            return False, schema_validate_msg
        with open(self.filename, 'r') as file:
            data_df = pd.read_csv(file, encoding = 'utf-8')
            data_df = UserLoader.migrate_user(data_df)
            is_color_provide = 'O_user_color' in data_df.columns
            # insert user data, 1. remove all users expect admin user, 2. insert non-admin users
            User.query.filter_by(is_admin=0).delete()
            db_session.commit()
            # retrieve the admin user
            admin_user = User.query.filter_by(is_admin=1).first().username
            for i in range(len(data_df)):
                data_df.at[i, 'M_assignment_by_image_id'] = data_df.at[i, 'M_assignment_by_image_id'].replace('; ',';')
                user_color = ('' if pd.isna(data_df.at[i,'O_user_color']) else data_df.at[i,'O_user_color']) if is_color_provide else ''
                if(data_df.at[i, 'M_username'] != admin_user):
                    hashed_password = bcrypt.generate_password_hash('123').decode('utf-8')
                    user = User(username=data_df.at[i, 'M_username'], is_admin=0, password = hashed_password,
                                assignment=data_df.at[i, 'M_assignment_by_image_id'], anno_index=data_df.at[i,'anno_index'],\
                                    anno_bbox_index = data_df.at[i,'anno_bbox_index'], user_color = user_color)
                    db_session.add(user)
                    db_session.commit()
                else:
                    admin_user = User.query.filter_by(is_admin=1).first()
                    admin_user.assignment = data_df.at[i, 'M_assignment_by_image_id']
                    admin_user.anno_index = data_df.at[i,'anno_index']
                    admin_user.anno_bbox_index = data_df.at[i,'anno_bbox_index']
                    admin_user.user_color = user_color
                    db_session.commit()
            return True, []

class SchemaLoader():

    def __init__(self, filename):
        self.filename = filename

    @staticmethod
    def validate_file_type(filename):
        '''
        check whether the current file is a csv file
        '''
        if(filename.endswith('.csv')):
            return True, []
        else:
            return False, ['The file type is not correct. Please upload a .csv file instead!']

    @staticmethod
    def validate_schema_rules(df):
        abbr_list = []
        id_list = []
        name_dic = {}
        for i in range(len(df)):
            if pd.isna(df.at[i,'M_label_name']) or df.at[i,'M_label_name'] == '':
                df.at[i,'M_label_name'] = ''

            if df.at[i,'M_label_type'] == 0:
                name_dic[df.at[i,'M_label_id']] = []
            else:
                if df.at[i,'M_label_name'].upper() not in name_dic[df.at[i,'M_label_parent']]:
                    name_dic[df.at[i,'M_label_parent']].append(df.at[i,'M_label_name'].upper())
                else:
                    return False, 'Error in label_schema.csv: Two identical M_label_names are not allowed in the same category (M_label_parent)!'

            if pd.isna(df.at[i,'M_label_abbr']) or df.at[i,'M_label_abbr'] == '':
                return False, 'Error in label_schema.csv: There are missing values in the M_label_abbr column!' 
            if ';' in df.at[i,'M_label_abbr'] or ':' in df.at[i,'M_label_abbr']:
                return False, "The ',' and ';' can't be used in label abbreviations!"
            if ';' in df.at[i,'M_label_name'] or ':' in df.at[i,'M_label_name']:
                return False, "The ',' and ';' can't be used in label names!"
            if ';' in df.at[i,'M_label_id'] or ':' in df.at[i,'M_label_id']:
                return False, "The ',' and ';' can't be used in the label id!"
            if df.at[i,'M_label_name'] == df.at[i,'M_label_parent']:
                return False, 'Error in label_schema.csv: The M_label_name should be different from the M_label_parent!' 
            if df.at[i,'M_label_type'] not in [-1,0,1,2,3,4,5,6,7,8,9,10]:
                return False, 'Error in label_schema.csv: Invalid value in the M_label_type column!' 
            # if df.at[i,'M_label_abbr'].upper() not in abbr_list:
            #     abbr_list.append(df.at[i,'M_label_abbr'].upper())
            # else:
            #     return False, 'Error in label_schema.csv: Repetition is not allowed in the M_label_abbr column!'
            if df.at[i,'M_label_id'].upper() not in id_list:
                abbr_list.append(df.at[i,'M_label_id'].upper())
            else:
                return False, 'Error in label_schema.csv: Repetition is not allowed in the M_label_id column!'
        return True, ''

    @staticmethod
    def validate_file_schema(filename):
        '''
        check if the current file follow the predefined schema
        check label_name, label_type, label_parent, label_placeholder, 
        '''
        schema_validate = True
        validation_message = []
        with open(filename, 'r') as file:
            data_df = pd.read_csv(file, encoding='utf-8')
            if('M_label_id' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_label_id column is missing in the label_schema.csv!')
            if('M_label_name' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_label_name column is missing in the label_schema.csv!')
            if('M_label_type' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_label_type column is missing in the label_schema.csv!')
            if('M_label_parent' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_label_parent column is missing in the label_schema.csv!')
            if('M_label_abbr' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_label_abbr column is missing in the label_schema.csv!')
            try:
                schema_rule_validate, msg = SchemaLoader.validate_schema_rules(data_df)
            except:
                schema_rule_validate = False
                msg = 'There label_schema.csv is not valid'
            if(schema_rule_validate == False):
                schema_validate = False
                validation_message.append(msg)
        return schema_validate, validation_message

    def load_schema_data(self):
        '''
        load the image data to the database
        '''
        file_type_validate, file_type_validate_msg = self.validate_file_type(
            self.filename)
        if(file_type_validate == False):
            return False, file_type_validate_msg
        schema_validate, schema_validate_msg = self.validate_file_schema(
            self.filename)
        if(schema_validate == False):
            return False, schema_validate_msg
        DBUtils.reset_database('schema')
        with open(self.filename, 'r') as file:
            data_df = pd.read_csv(file, encoding='utf-8')
            is_required_provide = 'O_label_required' in data_df.columns
            is_placeholder_provide = 'O_label_placeholder' in data_df.columns
            is_icon_provide = 'O_label_icon' in data_df.columns
            is_bbox_provide = 'O_label_bbox' in data_df.columns
            is_color_provide = 'O_label_color' in data_df.columns
            #rename the columns
            for i in range(len(data_df)):
                label_id = data_df.at[i,'M_label_id']
                label_name = data_df.at[i,'M_label_name']
                label_type = int(data_df.at[i,'M_label_type'])
                label_parent = data_df.at[i,'M_label_parent']
                label_abbr = data_df.at[i,'M_label_abbr']
                label_required = (0 if pd.isna(data_df.at[i,'O_label_required']) else int(data_df.at[i,'O_label_required'])) if is_required_provide else 0
                label_placeholder = ('' if pd.isna(data_df.at[i,'O_label_required']) else data_df.at[i,'O_label_placeholder']) if is_placeholder_provide else ''
                label_icon = ('' if pd.isna(data_df.at[i,'O_label_icon']) else data_df.at[i,'O_label_icon']) if is_icon_provide else ''
                label_bbox = (0 if pd.isna(data_df.at[i,'O_label_bbox']) else int(data_df.at[i,'O_label_bbox'])) if is_bbox_provide else 0
                label_color = ('' if pd.isna(data_df.at[i,'O_label_color']) else data_df.at[i,'O_label_color']) if is_color_provide else ''
                schema = Schema(label_id=label_id, label_name=label_name, label_type = label_type,
                            label_parent=label_parent, label_abbr = label_abbr,\
                                 label_isrequired=label_required, label_placeholder = label_placeholder,\
                                     label_icon_url = label_icon, label_isbbox = label_bbox, label_color = label_color)
                db_session.add(schema)
                db_session.commit()
            return True, []

class AnnotationLoader():

    def __init__(self, filename):
        self.filename = filename

    @staticmethod
    def validate_file_type(filename):
        '''
        check whether the current file is a csv file
        '''
        if(filename.endswith('.csv')):
            return True, []
        else:
            return False, ['The file type is not correct. Please upload a .csv file instead!']

    @staticmethod
    def validate_file_schema_raw(filename):
        '''
        only used for the raw format
        check if the current file follow the predefined schema
        check image_id, username, annotation_log, is_error_image
        '''
        schema_validate = True
        validation_message = []
        with open(filename, 'r') as file:
            data_df = pd.read_csv(file, encoding='utf-8')
            if('image_id' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The image_id column is missing in the uploaded file!')
            if('username' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The username column is missing in the uploaded file!')
            if('annotation_log' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The annotation_log column is missing in the uploaded file!')
            if('is_error_image' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The is_error_image column is missing in the uploaded file!')
        return schema_validate, validation_message

    @staticmethod
    def validate_file_schema(filename):
        '''
        only used for the converted format
        check if the current file follow the predefined schema
        check image_id, username, annotation_log, is_error_image
        '''
        schema_validate = True
        validation_message = []
        with open(filename, 'r') as file:
            data_df = pd.read_csv(file, encoding='utf-8')
            if('M_image_id' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_image_id column is missing in the annotation.csv!')
            if('M_image_name' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_image_id column is missing in the annotation.csv!')
            if('M_image_url' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The M_image_url column is missing in the annotation.csv!')
            if('user1 name' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The user1 name column is missing in the annotation.csv!')
            if('user2 name' not in data_df.columns):
                schema_validate = False
                validation_message.append(
                    'The user2 name column is missing in the annotation.csv!')
        return schema_validate, validation_message

    def load_annotation_data_raw(self):
        '''
        only used for the raw format
        load the image data to the database
        '''
        file_type_validate, file_type_validate_msg = self.validate_file_type(
            self.filename)
        if(file_type_validate == False):
            return False, file_type_validate_msg
        schema_validate, schema_validate_msg = self.validate_file_schema_raw(
            self.filename)
        if(schema_validate == False):
            return False, schema_validate_msg
        with open(self.filename, 'r') as file:
            data_df = pd.read_csv(file, encoding='utf-8')
            data_df.to_sql('annotation', con=engine, if_exists='replace')
            return True, []

    def load_annotation_data(self, schema_filename):
        '''
        only used for the converted format
        load the image data to the database
        '''
        file_type_validate, file_type_validate_msg = self.validate_file_type(
            self.filename)
        if(file_type_validate == False):
            return False, file_type_validate_msg
        schema_validate, schema_validate_msg = self.validate_file_schema(
            self.filename)
        if(schema_validate == False):
            return False, schema_validate_msg
        with open(self.filename, 'r') as file:
            annotation_df = pd.read_csv(file, encoding='utf-8')
            schema_df = pd.read_csv(schema_filename, encoding='utf-8')
            data_df = AnnotationConvertor.convert_readable_to_db(annotation_df, schema_df)
            data_df.to_sql('annotation', con=engine, if_exists='replace', index=True,
                  index_label='id')
            return True, []

class AnnotationExporter():

    def __init__(self, filename):
        self.filename = filename
        self.image_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'images.csv')
        self.user_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'users.csv')
        self.schema_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'label_schema.csv')
        self.annotation_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'annotations.csv')
        self.raw_annotation_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'raw_annotations.csv')

    @staticmethod
    def check_input_data():
        is_ready = True
        error_msg = []
        if not Annotation.query.first():
            is_ready = False
            error_msg.append('Please set up the annotation project first!')
        return is_ready, error_msg

    @staticmethod
    def zip_multiple_files(ziph, files):
        for file in files:
            ziph.write(file, file.split('/')[-1])

    def export_annotation_to_csv(self):
        is_ready, error_msg = AnnotationExporter.check_input_data()
        if not is_ready:
            return False, error_msg
        else:
            server_progress[0] = 2
            sql_query = pd.read_sql_query(
                '''SELECT * FROM image''', engine)
            image_df = pd.DataFrame(sql_query)
            image_df.to_csv(self.image_name, index=False, encoding='utf_8_sig')

            server_progress[0] = 15

            sql_query = pd.read_sql_query(
                '''SELECT * FROM user''', engine)
            user_df = pd.DataFrame(sql_query)
            user_df.to_csv(self.user_name, index=False, encoding='utf_8_sig')

            server_progress[0] = 20

            sql_query = pd.read_sql_query(
                '''SELECT * FROM schema''', engine)
            schema_df = pd.DataFrame(sql_query)
            schema_df.to_csv(self.schema_name, index=False, encoding='utf_8_sig')

            server_progress[0] = 25

            sql_query = pd.read_sql_query(
                '''SELECT * FROM annotation''', engine)
            anno_df = pd.DataFrame(sql_query)

            server_progress[0] = 30
            
            # using the converted version 
            # annoconvertor = AnnotationConvertor()
            # annoconvertor.convert_db_to_readable(anno_df, schema_df, image_df)

            # use the raw annotation, DEBUG
            print("use raw format")
            anno_df.to_csv(self.raw_annotation_name, index=False, encoding='utf_8_sig')

            server_progress[0] = 99

            zipf = zipfile.ZipFile(os.path.join(current_app.config['UPLOAD_FOLDER'], 'results.zip'), 'w', zipfile.ZIP_DEFLATED)
            # AnnotationExporter.zip_multiple_files(zipf, [self.annotation_name, self.image_name, self.user_name, self.schema_name]) DEBUG
            AnnotationExporter.zip_multiple_files(zipf, [self.raw_annotation_name, self.image_name, self.user_name, self.schema_name])
            zipf.close()

            server_progress[0] = 100
            return True, []

    def backup_database(self):
        
        sql_query = pd.read_sql_query(
            '''SELECT * FROM image''', engine)
        image_df = pd.DataFrame(sql_query)
        image_df.to_csv(self.image_name, index=False, encoding='utf_8_sig')

        sql_query = pd.read_sql_query(
            '''SELECT * FROM user''', engine)
        user_df = pd.DataFrame(sql_query)
        user_df.to_csv(self.user_name, index=False, encoding='utf_8_sig')

        sql_query = pd.read_sql_query(
            '''SELECT * FROM schema''', engine)
        schema_df = pd.DataFrame(sql_query)
        schema_df.to_csv(self.schema_name, index=False, encoding='utf_8_sig')

        sql_query = pd.read_sql_query(
            '''SELECT * FROM annotation''', engine)
        anno_df = pd.DataFrame(sql_query)
        anno_df.to_csv(self.raw_annotation_name, index=False, encoding='utf_8_sig')

        # annoconvertor = AnnotationConvertor()
        # annoconvertor.convert_db_to_readable(anno_df, schema_df, image_df)

        now = datetime.now() # current date and time
        date_time = now.strftime("%m-%d-%Y-%H-%M-%S")
        file_name = str(date_time) + '-backup.zip'
        print(date_time)
        zipf = zipfile.ZipFile(os.path.join(current_app.config['BACKUP_FOLDER'], file_name), 'w', zipfile.ZIP_DEFLATED)
        AnnotationExporter.zip_multiple_files(zipf, [self.user_name, self.schema_name, self.raw_annotation_name])
        zipf.close()

class AnnotationGenerator():

    @staticmethod
    def check_input_data():
        is_ready = True
        error_msg = []
        if not Image.query.first():
            is_ready = False
            error_msg.append('Please import the image dataset first!')
        if not User.query.filter_by(is_admin=0).first():
            is_ready = False
            error_msg.append('Please import the user dataset first!')
        if not Schema.query.first():
            is_ready = False
            error_msg.append('Please import the label schema first!')
        return is_ready, error_msg

    @staticmethod
    def migrate_database(data):
        '''
        migrate the old database to the new database
        '''
        if not Annotation.query.first():
            return data
        else:
            sql_query = pd.read_sql_query(
                '''SELECT * FROM annotation''', engine)
            old_data = pd.DataFrame(sql_query)
            old_data_dic = Utils.createTableDicTwoByData('image_id', 'username', old_data)
            column_list = data.columns.values.tolist()
            server_progress[0] = 80
            data_length = len(data)
            for i in range(len(data)):
                server_progress[0] = 80 + int(19 * (i / data_length))
                image_id = data.at[i,'image_id']
                user_name = data.at[i,'username']
                key = image_id + '-' + user_name
                old_record = old_data_dic[key][0]
                for c in column_list:
                    if(c in old_record):
                        data.at[i, c] = old_record[c]

            '''
            if the column type is object while the first entry is integer, convert the column type to int
            '''
            for c in column_list:
                if data[c].dtypes == 'object':
                    if isinstance(data.at[0,c], (int, np.integer)):
                        data[c] = data[c].astype(np.int64)

            return data

    @staticmethod
    def generate_annotation_table():
        '''
        generate annotation table based on the inputs
        1. check whether user inputs are ready
        2. get all image_id and image_name
        3. get all username
        4. get all label
        5. generate the pandas dataframe for the annotation data
        '''
        is_ready, error_msg = AnnotationGenerator.check_input_data()
        if not is_ready:
            return False, error_msg
        user_data = db_session.query(User.username, User.assignment).all()
        label_data = db_session.query(
            Schema.label_id, Schema.label_type, Schema.label_parent).all()
        anno_table_list = []
        for user in user_data:
            username = user.username
            if(user.assignment):
                assignment = user.assignment.split(';')
                if(len(assignment) == 1 and assignment[0] == ''):
                    assignment = []
                for image_id in assignment:
                    anno_table_dic = {}
                    anno_table_dic['image_id'] = image_id
                    anno_table_dic['username'] = username
                    anno_table_dic['annotation_log'] = ""
                    anno_table_dic['log_dates'] = ""
                    anno_table_dic['is_error_image'] = 0
                    anno_table_dic['need_discuss'] = 0
                    anno_table_dic['marked_fun'] = 0
                    anno_table_dic['marked_OK'] = 0
                    anno_table_dic['checked_caption'] = 0
                    anno_table_dic['checked_paper'] = 0
                    anno_table_dic['tracker'] = ""
                    for label in label_data:
                        if(int(label.label_type) == 0):
                            pass
                        elif(int(label.label_type) == 1):
                            anno_table_dic[label.label_id] = int(0)
                        elif(int(label.label_type) == 2):
                            anno_table_dic[label.label_parent] = ""
                        elif(int(label.label_type) == 3):
                            anno_table_dic[label.label_id] = ""
                        elif(int(label.label_type) == -1):
                            anno_table_dic[label.label_id] = ""
                    anno_table_dic['regions'] = ""
                    anno_table_list.append(anno_table_dic)
        df = pd.DataFrame(anno_table_list)
        df = AnnotationGenerator.migrate_database(df)
        # print(df['lab_3'].dtypes, type(df.at[0,'lab_3']), df['lab_3'].dtypes == 'int64')
        # print(df['lab_9'].dtypes, type(df.at[0,'lab_9']))
        # print(df['annotation_log'].dtypes, type(df.at[0,'annotation_log']))
        
        
        # print(df.dtypes)
        # df.to_csv('./raw_annotations_new.csv', index=False, encoding='utf_8_sig')
        DBUtils.reset_database('annotation')
        df.to_sql('annotation', con=engine, index=True,
                  index_label='id', if_exists='replace')
        return True, []

class AnnotationConvertor():

    def __init__(self):
        self.image_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'images.csv')
        self.user_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'users.csv')
        self.schema_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'label_schema.csv')
        self.annotation_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'annotations.csv')
        self.converted_readable_name = os.path.join(current_app.config['UPLOAD_FOLDER'], 'annotations.csv')

    def convert_db_to_readable(self, annotation_data, shema_data, image_data):
        '''
        convert the database format to human readable format
        '''
        data_dic = Utils.createTableDicByData('image_id', annotation_data)
        server_progress[0] = 40
        schema_dic = Utils.createTableDicByData('label_id', shema_data)
        image_dic = Utils.createTableDicByData('image_id', image_data)
        
        #schema
        #get categories
        categories = []
        for label_id in schema_dic:
            if(schema_dic[label_id][0]['label_parent'] == 'root'):
                categories.append(label_id)

        table_list = []
        data_length = len(data_dic.keys())

        for index, image_id in enumerate(data_dic):
            server_progress[0] = 45 + int(54 * (index / data_length))
            table_dic = {}
            #image meta
            image_name = image_dic[image_id][0]['image_name']
            image_url = image_dic[image_id][0]['image_url']

            table_dic['M_image_id'] = image_id
            table_dic['M_image_name'] = image_name
            table_dic['M_image_url'] = image_url

            #user meta, all results are assumed there are two users
            usernames = []
            table_dic['user1 name'] = data_dic[image_id][0]['username']
            usernames.append(data_dic[image_id][0]['username'])
            if(len(data_dic[image_id]) == 2):
                table_dic['user2 name'] = data_dic[image_id][1]['username']
                usernames.append(data_dic[image_id][1]['username'])
            elif(len(data_dic[image_id]) == 1):
                table_dic['user2 name'] = ''
                usernames.append('')

            #annotations
            annotations = data_dic[image_id]
            user_res = {} #store the results of each user
            for record in annotations:
                username = record['username']
                
                for category in categories:
                    user_res[username + '-' +category] = []

                for label_id in schema_dic:
                    if(schema_dic[label_id][0]['label_type'] == 1):
                        if(record[label_id] == 1):
                            label_name = schema_dic[label_id][0]['label_name']
                            user_res[username + '-' +schema_dic[label_id][0]['label_parent']].append(label_name)
                    if(schema_dic[label_id][0]['label_type'] == 2):
                        if(record[schema_dic[label_id][0]['label_parent']] == label_id):
                            label_name = schema_dic[label_id][0]['label_name']
                            user_res[username + '-' +schema_dic[label_id][0]['label_parent']].append(label_name)
                    if(schema_dic[label_id][0]['label_type'] == 3):
                        if(record[label_id] != '' and record[label_id] != None):
                            if schema_dic[label_id][0]['label_name'] == None:
                                text = ':' + record[label_id]
                            else:
                                text = schema_dic[label_id][0]['label_name'] + ':' + record[label_id]
                            user_res[username + '-' +schema_dic[label_id][0]['label_parent']].append(text)
            
                user_res[username + '-is_error_image'] = record['is_error_image']
                user_res[username + '-need_discuss'] = record['need_discuss']
                user_res[username + '-marked_fun'] = record['marked_fun']
                user_res[username + '-marked_OK'] = record['marked_OK']
                user_res[username + '-checked_caption'] = record['checked_caption']
                user_res[username + '-checked_paper'] = record['checked_paper']
                user_res[username + '-regions'] = record['regions']
                user_res[username + '-annotation_log'] = record['annotation_log']
                user_res[username + '-log_dates'] = record['log_dates']
                user_res[username + '-tracker'] = record['tracker']
                
            table_dic['user1' + '-is_error_image'] = user_res[usernames[0] + '-is_error_image']
            if(usernames[1] != ''):
                table_dic['user2' + '-is_error_image'] = user_res[usernames[1] + '-is_error_image']
            else:
                table_dic['user2' + '-is_error_image'] = 0
            
            table_dic['user1' + '-need_discuss'] = user_res[usernames[0] + '-need_discuss']
            if(usernames[1] != ''):
                table_dic['user2' + '-need_discuss'] = user_res[usernames[1] + '-need_discuss']
            else:
                table_dic['user2' + '-need_discuss'] = 0
                
            table_dic['user1' + '-marked_fun'] = user_res[usernames[0] + '-marked_fun']
            if(usernames[1] != ''):
                table_dic['user2' + '-marked_fun'] = user_res[usernames[1] + '-marked_fun']
            else:
                table_dic['user2' + '-marked_fun'] = 0
                
            table_dic['user1' + '-marked_OK'] = user_res[usernames[0] + '-marked_OK']
            if(usernames[1] != ''):
                table_dic['user2' + '-marked_OK'] = user_res[usernames[1] + '-marked_OK']
            else:
                table_dic['user2' + '-marked_OK'] = 0
                
            table_dic['user1' + '-checked_caption'] = user_res[usernames[0] + '-checked_caption']
            if(usernames[1] != ''):
                table_dic['user2' + '-checked_caption'] = user_res[usernames[1] + '-checked_caption']
            else:
                table_dic['user2' + '-checked_caption'] = 0
                
            table_dic['user1' + '-checked_paper'] = user_res[usernames[0] + '-checked_paper']
            if(usernames[1] != ''):
                table_dic['user2' + '-checked_paper'] = user_res[usernames[1] + '-checked_paper']
            else:
                table_dic['user2' + '-checked_paper'] = 0
            
            #print(user_res)
            for category in categories:
                category_name =  schema_dic[category][0]['label_name']
                table_dic['user1-' + category_name] = '; '.join(user_res[usernames[0] + '-' + category])
                if(usernames[1] != ''):
                    table_dic['user2-' + category_name] = '; '.join(user_res[usernames[1] + '-' + category])
                else:
                    table_dic['user2-' + category_name] = ''
            
            table_dic['user1' + '-regions'] = user_res[usernames[0] + '-regions']
            if(usernames[1] != ''):
                table_dic['user2' + '-regions'] = user_res[usernames[1] + '-regions']
            else:
                table_dic['user2' + '-regions'] = 0
                
            table_dic['user1' + '-annotation_log'] = user_res[usernames[0] + '-annotation_log']
            if(usernames[1] != ''):
                table_dic['user2' + '-annotation_log'] = user_res[usernames[1] + '-annotation_log']
            else:
                table_dic['user2' + '-annotation_log'] = ''
                
            table_dic['user1' + '-log_dates'] = user_res[usernames[0] + '-log_dates']
            if(usernames[1] != ''):
                table_dic['user2' + '-log_dates'] = user_res[usernames[1] + '-log_dates']
            else:
                table_dic['user2' + '-log_dates'] = ''

            table_dic['user1' + '-tracker'] = user_res[usernames[0] + '-tracker']
            if(usernames[1] != ''):
                table_dic['user2' + '-tracker'] = user_res[usernames[1] + '-tracker']
            else:
                table_dic['user2' + '-tracker'] = ''

            table_list.append(table_dic)
                
        df = pd.DataFrame(table_list)
        df.to_csv(self.converted_readable_name, index=False, encoding='utf_8_sig')


    @staticmethod
    def create_schema_dic_by_names(data, schema_dic):
        dataDic = {}
        column_list = data.columns.values.tolist()
        for i in range(len(data)):
            dataID1 = data.at[i,'M_label_name']
            dataID2 = data.at[i,'M_label_parent']
            if(dataID2 in schema_dic):
                dataID2 = schema_dic[dataID2][0]['M_label_name']
            dataID = str(dataID2) + '-' + str(dataID1)
            if(dataID in dataDic):
                dataInfo = {}
                for key in column_list:
                    dataInfo[key] = data.loc[i,key]
                dataDic[dataID].append(dataInfo)
            else:
                dataInfo = {}
                for key in column_list:
                    dataInfo[key] = data.loc[i,key]
                dataDic[dataID] = [dataInfo]
        return dataDic 


    @staticmethod
    def convert_readable_to_db(annotation_data, schema_data):
        '''
        convert human readable csv to the database format
        '''
        schema_id_dic = Utils.createTableDicByData('M_label_id', schema_data)
        schema_dic = AnnotationConvertor.create_schema_dic_by_names(schema_data, schema_id_dic)
        anno_table_list = []

        for i in range(len(annotation_data)):
            image_id = annotation_data.at[i,'M_image_id']
            user_dic = {}
            user_dic['user1'] = annotation_data.at[i,'user1 name']
            user_dic['user2'] = annotation_data.at[i,'user2 name']
            if(pd.isna(user_dic['user2'])):
                users = ['user1']
            else:
                users = ['user1', 'user2']
            
                
            for user in users:
                table_dic = {}
                table_dic['image_id'] = image_id
                table_dic['username'] = user_dic[user]
                table_dic['annotation_log'] = annotation_data.at[i,user+'-annotation_log']
                table_dic['log_dates'] = annotation_data.at[i,user+'-log_dates']
                table_dic['is_error_image'] = annotation_data.at[i,user+'-is_error_image']
                table_dic['need_discuss'] = annotation_data.at[i,user+'-need_discuss']
                table_dic['marked_fun'] = annotation_data.at[i,user+'-marked_fun']
                table_dic['marked_OK'] = annotation_data.at[i,user+'-marked_OK']
                table_dic['checked_caption'] = annotation_data.at[i,user+'-checked_caption']
                table_dic['checked_paper'] = annotation_data.at[i,user+'-checked_paper']
                table_dic['tracker'] = '' # TODO: for now, ignore the tracker
                categories = []
                for label_id in schema_id_dic:
                    label_type = schema_id_dic[label_id][0]['M_label_type']
                    if(int(label_type) == 0):
                        categories.append(schema_id_dic[label_id][0]['M_label_name'])
                    elif(int(label_type) == 1):
                        table_dic[label_id] = int(0)
                    elif(int(label_type) == 2):
                        table_dic[schema_id_dic[label_id][0]['M_label_parent']] = ""
                    elif(int(label_type) == 3):
                        table_dic[label_id] = ""
                
                if(pd.isna(annotation_data.at[i,user+'-regions'])):
                    table_dic['regions'] = ""
                else:
                    table_dic['regions'] = annotation_data.at[i,user+'-regions']
                for category in categories:
                    record = annotation_data.at[i,user+'-'+category]
                    if(not pd.isna(record)):
                        record = record.split('; ')
                        for name in record:
                            key = category + '-' + name
                            if(key in schema_dic):
                                label_id = schema_dic[key][0]['M_label_id']
                                label_type = schema_dic[key][0]['M_label_type']
                                if(int(label_type) == 1):
                                    table_dic[label_id] = int(1)
                                elif(int(label_type) == 2):
                                    table_dic[schema_id_dic[label_id][0]['M_label_parent']] = label_id
                            else:
                                text_name = name.split(':')[0]
                                key = category + '-' + text_name
                                text = name.split(':')[1]
                                label_id = schema_dic[key][0]['M_label_id']
                                table_dic[label_id] = text
                
                anno_table_list.append(table_dic)
                
        df = pd.DataFrame(anno_table_list)

        return df