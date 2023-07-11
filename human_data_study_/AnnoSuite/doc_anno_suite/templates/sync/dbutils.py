from os import stat
import pandas as pd
from sqlalchemy.sql.elements import Label
from sqlalchemy.sql.functions import user
from doc_anno_suite.database import engine
from doc_anno_suite.database import db_session
from doc_anno_suite.models import User, Image, Schema, Annotation
from sqlalchemy import text
from datetime import datetime
from dataclasses import asdict

class AnnotationUtil():

    @staticmethod
    def check_input_data():
        is_ready = True
        error_msg = []
        if not Annotation.query.first():
            is_ready = False
            error_msg.append('Please set up the annotation project first!')
        return is_ready, error_msg

    @staticmethod
    def check_annotation_type(annotation, type):
        '''
        determine whether an image was been annotated by any of the annotators
        1. get all labels.
        2. based on the label type, check if the current image was annotated.
        type: 0: not annotated, 1: annotated
        '''
        labels = DatabaseCRUD.get_label_schemas_as_dict()
        filter_res = []
        for record in annotation:
            is_annotated = 0
            for label_id in labels:
                label = labels[label_id]
                label_type = label['label_type']
                if(int(label_type) == 1):
                    if(int(record[label_id]) == 1):
                        is_annotated = 1
                elif(int(label_type) == 2):
                    if(record[label['label_parent']] != ""):
                        is_annotated = 1
                elif(int(label_type) == 3):
                    if(record[label_id] != ""):
                        is_annotated = 1
            if(type == is_annotated):
                filter_res.append(record)
        return filter_res

    @staticmethod
    def filter_image_by_users(res, users):
        '''
        only keep these images that were assigned to all users
        '''
        res = [x for x in res if len(x['annotators']) == len(users)]
        # res = filter(lambda x: len(x['annotators']) == len(users), res)
        return res

    @staticmethod
    def check_consistency(annotation, type):
        '''
        return consistent or inconsistent results
        1: consistent
        0: inconsistent
        group the annotation results by image name, then compare, exclude the type 3 annotations
        '''
        labels = DatabaseCRUD.get_label_schemas_as_dict()
        
        filter_res = []
        for group in annotation:
            record = group['annotations']
            if(len(record.keys()) < 2):
                continue
            else:
                is_consistency = 1
                user1 = group['annotators'][0]
                user2 = group['annotators'][1]
                for label_id in labels:
                    label = labels[label_id]
                    label_type = label['label_type']
                    if(int(label_type) == 1):
                        if(record[user1][label_id] != record[user2][label_id]):
                            is_consistency = 0
                    elif(int(label_type) == 2):
                        if(record[user1][label['label_parent']] != record[user2][label['label_parent']]):
                            is_consistency = 0
                if(type == is_consistency):
                    filter_res.append(group)

        return filter_res

    @staticmethod
    def exclude_operation(res_all, res):
        query_images = {}
        filter_res = []
        for record in res:
            query_images[record['image_id']] = record['annotators']
        for record in res_all:
            image_id = record['image_id']
            if(image_id not in query_images):
                filter_res.append(record)
            else:
                if(record['username'] not in query_images[image_id]):
                    filter_res.append(record)
        return filter_res

    @staticmethod
    def sort_res_by_paper(res_all, res):
        '''
        sort the query results by paper
        1. get all paper urls from res
        2. get all record from res_all
        3. sort by paper url
        '''
        paper_urls = set(map(lambda x: x['paper_url'], res))
        res_all = filter(lambda x: x['paper_url'] in paper_urls, res_all)
        res_all = sorted(res_all, key = lambda d: d['paper_url'])
        return res_all

    @staticmethod
    def group_annotation_by_imageid(annotation):
        '''
        group the annotation results by image id
        '''
        grouped_dic = {}
        for record in annotation:
            if(record['image_id'] not in grouped_dic):
                grouped_dic[record['image_id']] = [record]
            else:
                grouped_dic[record['image_id']].append(record)
        grouped_res = []
        for image_id in grouped_dic:
            image_meta = {}
            image_meta['image_id'] = image_id
            image_meta['image_name'] = grouped_dic[image_id][0]['image_name']
            image_meta['image_url'] = grouped_dic[image_id][0]['image_url']
            image_meta['need_discuss'] = grouped_dic[image_id][0]['need_discuss']
            image_meta['paper_url'] = grouped_dic[image_id][0]['paper_url']
            image_meta['caption_url'] = grouped_dic[image_id][0]['caption_url']
            image_meta['rank'] = grouped_dic[image_id][0]['rank']
            image_meta['annotations'] = {}
            for record in grouped_dic[image_id]:
                image_meta['annotations'][record['username']] = record
            image_meta['annotators'] = []
            for annotation in grouped_dic[image_id]:
                image_meta['annotators'].append(annotation['username'])
            grouped_res.append(image_meta)
        return grouped_res

    @staticmethod
    def replace_none_labels(labels):
        '''
        remove categories without any childrens or only contains single free-text children
        not used here
        '''
        for label in labels:
            if(label.label_name == None):
                label.label_name = 'Not null'

        return labels

class DatabaseCRUD():

    @staticmethod
    def get_bbox_label_schemas():
        return Schema.query.filter_by(label_isbbox=1).all()

    @staticmethod
    def get_bbox_label_schemas_as_dict():
        labels = Schema.query.filter_by(label_isbbox=1).with_entities(Schema.label_id, Schema.label_type, \
            Schema.label_parent, Schema.label_name, Schema.label_abbr, Schema.label_color).all()
        label_dict = {label[0] : {'label_type': label[1], 'label_parent': label[2],\
             'label_name': label[3], 'label_abbr': label[4], 'label_color': label[5]}  for label in labels}
        return label_dict

    @staticmethod
    def filter_label(labels, type, data_type):
        '''
        filter labels with specific types
        type: type from -1 to 5
        labels: a list of labels
        data_type: 0: list, 1: dict
        '''
        if(data_type == 'list'):
            filter_res = []
            filtered_label_id = []
            for label in labels:
                if(label.label_type in type):
                    filtered_label_id.append(label.label_id)
            filtered_label_id = list(set(filtered_label_id))
                    
            for label in labels:
                if(label.label_id not in filtered_label_id):
                    filter_res.append(label)
            return filter_res
        elif(data_type == 'dict'):
            removed_key = []
            for key in labels:
                if(labels[key]['label_type'] in type):
                    removed_key.append(key)
            removed_key = list(set(removed_key))
            for key in removed_key:
                del labels[key]
            return labels

    @staticmethod
    def get_label_schemas(filter_type = [-1]):
        '''Retrive all labels 
        Args:
        filter_type: 
            remove all labels with this type

        Returns:
        A list that contains all labels
        '''
        return DatabaseCRUD.filter_label(Schema.query.all(), filter_type, 'list') 

    @staticmethod
    def get_label_schemas_as_dict(filter_type = [-1]):
        labels = Schema.query.with_entities(Schema.label_id, Schema.label_type, Schema.label_parent, \
            Schema.label_name, Schema.label_abbr, Schema.label_isrequired, Schema.label_icon_url, Schema.label_color).all()
        label_dict = {label[0] : {'label_type': label[1], 'label_parent': label[2], \
            'label_name': label[3], 'label_abbr': label[4], 'label_isrequired': label[5], 'label_icon_url':label[6], 'label_color': label[7]}  for label in labels}
        label_dict = DatabaseCRUD.filter_label(label_dict, filter_type, 'dict')
        return label_dict

    @staticmethod
    def get_label_schemas_as_name_dict():
        labels = Schema.query.with_entities(Schema.label_id, Schema.label_type, Schema.label_parent, \
            Schema.label_name, Schema.label_abbr, Schema.label_isrequired, Schema.label_icon_url).all()
        label_dict = {label[3] : {'label_type': label[1], 'label_parent': label[2], \
            'label_id': label[0], 'label_abbr': label[4], 'label_isrequired': label[5], 'label_icon_url':label[6]}  for label in labels}
        return label_dict

    @staticmethod
    def get_label_schemas_as_list(filter_type = [-1]):
        labels = DatabaseCRUD.filter_label(Schema.query.all(), filter_type, 'list')
        res = []
        for label in labels:
            res.append(label.label_id)
        return res

    @staticmethod
    def get_hierarchical_label_schemas(filter_type = [-1]):
        labels = Schema.query.with_entities(Schema.label_id, Schema.label_type, Schema.label_parent, Schema.label_name).all()
        label_dict = {label[0] : {'label_type': label[1], 'label_parent': label[2], 'label_name': label[3]}  for label in labels}
        label_dict = DatabaseCRUD.filter_label(label_dict, filter_type, 'dict')
        res = []
        res_dic = {}
        for label_id in label_dict:
            label = label_dict[label_id]
            if label['label_parent'] == 'root':
                res.append(res_dic)
                res_dic = {}
                res_dic['category_id'] = label_id
                res_dic['category_name'] = label['label_name']
                res_dic['labels'] = ['placeHolder']
                res_dic['children'] = []
            else:
                label_dic = {}
                label_dic['label_id'] = label_id
                label_dic['label_name'] = label['label_name']
                label_dic['label_parent'] = label['label_parent']
                label_dic['label_type'] = label['label_type']
                if(int(label['label_type']) != 3):
                    res_dic['labels'].append(label_dic)
                if int(label['label_type']) == 1:
                    res_dic['children'].append(label_id)
                elif int(label['label_type']) == 2:
                    res_dic['children'].append(label_id)
        res.append(res_dic)
        return res[1:]

    @staticmethod
    def get_category_type_dic():
        '''
        Retrive the type of each category
        '''
        labels = Schema.query.with_entities(Schema.label_id, Schema.label_type, Schema.label_parent, Schema.label_name).all()
        label_dict = {label[0] : {'label_type': label[1], 'label_parent': label[2], 'label_name': label[3]}  for label in labels}
        res_dic = {}
        for label_id in label_dict:
            label = label_dict[label_id]
            if label['label_parent'] == 'root':
                res_dic[label_id] = {}
                res_dic[label_id]['category_name'] = label['label_name']
            else:
                type = label['label_type']
                parent = label['label_parent']
                res_dic[parent]['category_type'] = int(type)     
        return res_dic


    @staticmethod
    def get_user_by_username(username):
        return User.query.filter_by(username=username).first()

    @staticmethod
    def get_all_assigned_users():
        users = db_session.query(User.username).filter(User.assignment != None).all()
        return [user[0] for user in users]

    @staticmethod
    def get_user_colors():
        users = User.query.with_entities(User.username, User.user_color)
        user_dict = {user[0]: user[1] for user in users}
        return user_dict

    @staticmethod
    def get_all_years():
        years = db_session.query(Image.year).distinct().all()
        years = [int(year[0]) for year in years]
        years.sort()
        years = [str(year) for year in years]
        return years

    @staticmethod
    def update_user_progress(username, anno_index):
        user = User.query.filter_by(username=username).first()
        user.anno_index = anno_index
        db_session.commit()

    @staticmethod
    def update_user_bbox_progress(username, anno_index):
        user = User.query.filter_by(username=username).first()
        user.anno_bbox_index = anno_index
        db_session.commit()

    @staticmethod
    def get_annotation_by_username_image_id(username, image_id):
        '''
        generally, there are two approches to convert the query results to dictionary
        1. https://stackoverflow.com/a/68431203/13644433
        using the conventional approach to excute sql and convert to a dict
        2. using pandas to create the dataframe and convert to a dict. (slower than approach 1)
        start = time.time()
        sql_query = pd.read_sql_query()
        res = sql_query.to_dict('records')
        end = time.time()
        print("time excution:", end - start)
        '''
        with engine.connect() as conn:
            sql = 'SELECT annotation.*, image.image_name, image.caption_url, image.image_url, image.paper_url,\
                 image.rank, image.year from image INNER JOIN annotation on image.image_id = annotation.image_id\
                      where annotation.username = :u and annotation.image_id = :i'
            res = conn.execute(sql, u=username, i=image_id)
            return [dict(row) for row in res]

    @staticmethod
    def get_all_annotations():
        with engine.connect() as conn:
            sql = 'SELECT annotation.*, image.image_name, image.caption_url, image.image_url, image.paper_url,\
                 image.rank, image.year from image INNER JOIN annotation on image.image_id = annotation.image_id'
            res = conn.execute(sql)
            return [dict(row) for row in res]

    @staticmethod
    def get_annotation_by_query_condition(query_str):
        with engine.connect() as conn:
            res = conn.execute(query_str)
            return [dict(row) for row in res]

    @staticmethod
    def update_annotation_log(username, image_id, log):
        current_date = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
        annotation = Annotation.query.filter_by(username = username, image_id = image_id).first()
        if(annotation is None):
            return 0
        else:
            #print(annotation.annotation_log)
            if(annotation.annotation_log == '' or annotation.annotation_log == None):
                annotation.annotation_log = log
            else:
                annotation.annotation_log = annotation.annotation_log + '; ' + log
            if(annotation.log_dates == '' or annotation.log_dates == None):
                annotation.log_dates = current_date
            else:
                annotation.log_dates = annotation.log_dates + '; ' + current_date
            db_session.commit()
            return 1

    @staticmethod
    def update_label_all(image_id, label_id, value, type, log):
        with engine.connect() as conn:
            #https://stackoverflow.com/questions/25387537/inserting-a-table-name-into-a-query-gives-sqlite3-operationalerror-near-sy/25387570#25387570
            if(type == 'str'):
                sql = f'''UPDATE annotation SET \'{label_id}\' = \'{value}\' WHERE image_id = \'{image_id}\''''
            else:
                sql = f'''UPDATE annotation SET '{label_id}' = {value} WHERE image_id = \'{image_id}\''''
            conn.execute(sql)
            #update logs
            current_date = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            rows = Annotation.query.filter_by(image_id = image_id)
            if(rows is None):
                return 0
            else:
                for row in rows:
                    if(row.annotation_log == '' or row.annotation_log == None):
                        row.annotation_log = log
                    else:
                        row.annotation_log = row.annotation_log + '; ' + log
                    if(row.log_dates == '' or row.log_dates == None):
                        row.log_dates = current_date
                    else:
                        row.log_dates = row.log_dates + '; ' + current_date
                db_session.commit()
                return 1

    @staticmethod
    def update_label(username, image_id, label_id, value, type, log):
        with engine.connect() as conn:
            #https://stackoverflow.com/questions/25387537/inserting-a-table-name-into-a-query-gives-sqlite3-operationalerror-near-sy/25387570#25387570
            if(type == 'str'):
                sql = f'''UPDATE annotation SET \'{label_id}\' = \'{value}\' WHERE image_id = \'{image_id}\' AND username = \'{username}\''''
            else:
                sql = f'''UPDATE annotation SET '{label_id}' = {value} WHERE image_id = \'{image_id}\' AND username = \'{username}\''''
            conn.execute(sql)
            #update logs
            current_date = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            rows = Annotation.query.filter_by(image_id = image_id, username = username)
            if(rows is None):
                return 0
            else:
                for row in rows:
                    if(row.annotation_log == ''):
                        row.annotation_log = log
                    else:
                        row.annotation_log = row.annotation_log + '; ' + log
                    if(row.log_dates == ''):
                        row.log_dates = current_date
                    else:
                        row.log_dates = row.log_dates + '; ' + current_date
                db_session.commit()
                return 1

    @staticmethod
    def update_tracker_data(username, image_id, value):
        rows = Annotation.query.filter_by(image_id = image_id, username = username)
        if(rows is None):
            return 0
        else:
            current_date = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            for row in rows:
                if(row.tracker == ''):
                    row.tracker = f'{{"{current_date}":{value}}}'
                else:
                    row.tracker = row.tracker[:-1] + f',"{current_date}":{value}}}'
            db_session.commit()
            return 1

        

    
     


