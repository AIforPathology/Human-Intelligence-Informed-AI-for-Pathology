from doc_anno_suite.annotations.dbutils import DatabaseCRUD
from flask import current_app
import os
from io import BytesIO
from matplotlib.figure import Figure
import matplotlib.pyplot as plt
from matplotlib.transforms import IdentityTransform
import matplotlib
matplotlib.use("Agg")
import shutil
import time

class ColorUtils():
    '''
    generate visually distinct colors
    source 1: https://github.com/connorgr/colorgorical brown colorgorical
    source 2: https://github.com/taketwo/glasbey glasbey, based on the CAM02-UCS color space
    '''

    colors = [
        '#68ac57',
        '#487eb3',
        '#d2352b',
        '#8e549f',
        '#ef8532',
        '#fffd61',
        '#9c5933',
        '#e889bd',
        '#999999',
        '#19410e',
        '#73fbfd',
        '#001089',
        '#570d29',
        '#4f4e51',
        '#af9df8',
        '#45116b',
        '#367e6d',
        '#98faa4',
        '#6b6b1e',
        '#ddc792',
        '#79c0f9',
        '#c72e81',
        '#55360e',
        '#65b8a9',
        '#af9a31'
    ]

    @staticmethod
    def generate_n_distint_colors(n):
        return ColorUtils.colors[:n]

class IconUtils():
    '''
    get or generate icons for the labels
    '''

    @staticmethod
    def reset_icons():
        root_path = current_app.config['LABEL_ICON_FOLDER']
        if(os.path.isdir(root_path)):
            shutil.rmtree(root_path)
        os.mkdir(root_path)

    @staticmethod
    def get_label_icons():
        IconUtils.reset_icons()
        labels = DatabaseCRUD.get_label_schemas_as_dict()
        root_path = current_app.config['LABEL_ICON_FOLDER']
        icon_dic = {}
        for label_id in labels:
            timestamp = str(int(time.time()))
            path = os.path.join(root_path, str(label_id) + '-' + timestamp + '.png')
            IconUtils.text_to_icon(labels[label_id]['label_abbr'], path)
            icon_dic[label_id] = '../static/images/label_icons/' + str(label_id) + '-' + timestamp + '.png'
        return icon_dic


    @staticmethod
    def text_to_icon(text, filename):
        '''
        FOR single character: size = 150,
        two chars: size = 100
        three chars: size = 65
        '''
        if(text == None):
            text = ''
        else:
            text = text.upper()[:3]
        fig = plt.figure(figsize=(2,2), facecolor="none", dpi=100)
        fig.text(0.5, 0.4, text, color="dimgray", fontsize=60, fontweight='bold', ha = 'center',va = 'center', style = 'italic')
        plt.savefig(filename, facecolor=fig.get_facecolor())

    