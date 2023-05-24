#%%
import pandas as pd

meta =pd.read_csv('usefulFixationsWithTumorsEccentricity.csv')
meta =meta[meta['username']!='P6']
meta.to_csv('usefulFixationsWithTumorsEccentricity.csv')

# %%
