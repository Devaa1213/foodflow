"""Local mock database adapter. No Firebase or external database required."""
from copy import deepcopy
from datetime import datetime, timezone
import uuid

class Doc:
    def __init__(self, collection, doc_id, data=None):
        self.collection, self.id, self._data = collection, doc_id, data
    @property
    def exists(self): return self._data is not None
    def to_dict(self): return deepcopy(self._data or {})

class Query:
    def __init__(self, collection, filters=None): self.collection, self.filters = collection, filters or []
    def where(self, field, op, value): return Query(self.collection, self.filters + [(field, op, value)])
    def stream(self):
        values = list(self.collection.data.items())
        for field, op, value in self.filters:
            if op == '==': values = [(k,v) for k,v in values if v.get(field) == value]
            elif op == 'in': values = [(k,v) for k,v in values if v.get(field) in value]
        return [Doc(self.collection, k, v) for k,v in values]
    def document(self, doc_id=None): return Document(self.collection, doc_id or str(uuid.uuid4()))
    def doc(self, doc_id=None): return self.document(doc_id)

class Document:
    def __init__(self, collection, doc_id): self.collection, self.id = collection, doc_id
    def set(self, data, merge=False):
        self.collection.data[self.id] = ({**self.collection.data.get(self.id, {}), **deepcopy(data)} if merge else deepcopy(data))
    def update(self, data):
        if self.id not in self.collection.data: raise KeyError(self.id)
        self.collection.data[self.id].update(deepcopy(data))
    def get(self): return Doc(self.collection, self.id, self.collection.data.get(self.id))
    def delete(self): self.collection.data.pop(self.id, None)

class Collection(Query):
    def __init__(self, name): self.name, self.data = name, {}; super().__init__(self)
    def document(self, doc_id=None): return Document(self, doc_id or str(uuid.uuid4()))

class MockDB:
    def __init__(self): self.collections = {}; self.seed()
    def collection(self, name):
        if name not in self.collections: self.collections[name] = Collection(name)
        return self.collections[name]
    def seed(self):
        restaurants = [
          ('rest_greenleaf', {'name':'Green Leaf Kitchen','cuisine':'Healthy / Multi-cuisine','rating':4.6,'prepTimeMin':20,'avgPrepTimeMin':20,'deliveryTimeMin':30,'lat':14.4426,'lng':79.9865,'image':'assets/images/restaurant-greenleaf.jpg'}),
          ('rest_villagespice', {'name':'Village Spice','cuisine':'South Indian','rating':4.4,'prepTimeMin':18,'avgPrepTimeMin':18,'deliveryTimeMin':28,'lat':14.4502,'lng':79.9911,'image':'assets/images/restaurant-villagespice.jpg'}),
          ('rest_rustictable', {'name':'The Rustic Table','cuisine':'North Indian / Continental','rating':4.7,'prepTimeMin':25,'avgPrepTimeMin':25,'deliveryTimeMin':35,'lat':14.4381,'lng':79.9798,'image':'assets/images/restaurant-rustictable.jpg'})]
        for rid, data in restaurants: self.collection('restaurants').document(rid).set(data)
        menu = [('rest_rustictable','Chicken Biryani',220,'Main Course'),('rest_villagespice','Masala Dosa',90,'Breakfast'),('rest_villagespice','Fresh Lime Soda',40,'Beverages'),('rest_greenleaf','Paneer Tikka',180,'Starters'),('rest_greenleaf','Veg Meals',150,'Main Course'),('rest_rustictable','Butter Chicken',240,'Main Course')]
        for rid,n,p,c in menu: self.collection('menuItems').document().set({'restaurantId':rid,'name':n,'price':p,'category':c,'available':True})
        for rid,n,q,u,d in [('rest_rustictable','Rice',15,'kg',10),('rest_rustictable','Chicken',8,'kg',9),('rest_greenleaf','Vegetables',12,'kg',7),('rest_villagespice','Bread',30,'units',25)]: self.collection('inventory').document().set({'restaurantId':rid,'name':n,'quantity':q,'unit':u,'predictedDemand':d})
        partners=[('partner_arun',{'name':'Arun','status':'online','lat':14.4410,'lng':79.9850,'activeOrders':1,'deliveriesToday':6,'rating':4.7}),('partner_kiran',{'name':'Kiran','status':'online','lat':14.4440,'lng':79.9880,'activeOrders':0,'deliveriesToday':4,'rating':4.8}),('partner_rahul',{'name':'Rahul','status':'offline','lat':14.4360,'lng':79.9790,'activeOrders':0,'deliveriesToday':9,'rating':4.5})]
        for pid,p in partners: self.collection('deliveryPartners').document(pid).set(p)
        users=[('demo_customer',{'name':'Demo Customer','email':'customer@foodflow.demo','role':'customer'}),('rest_greenleaf',{'name':'Green Leaf Kitchen','email':'restaurant@foodflow.demo','role':'restaurant'}),('partner_arun',{'name':'Arun','email':'delivery@foodflow.demo','role':'delivery'}),('demo_admin',{'name':'FoodFlow Admin','email':'admin@foodflow.demo','role':'admin'})]
        for uid,u in users: self.collection('users').document(uid).set(u)
        now=datetime.now(timezone.utc).isoformat()
        sample=[{'customerId':'demo_customer','customerName':'Demo Customer','restaurantId':'rest_greenleaf','restaurantName':'Green Leaf Kitchen','items':[{'name':'Veg Meals','price':150,'quantity':1}],'subtotal':150,'deliveryFee':40,'total':190,'status':'PREPARING','createdAt':now,'deliveryPartnerId':None}, {'customerId':'demo_customer','customerName':'Demo Customer','restaurantId':'rest_rustictable','restaurantName':'The Rustic Table','items':[{'name':'Chicken Biryani','price':220,'quantity':1}],'subtotal':220,'deliveryFee':40,'total':260,'status':'OUT_FOR_DELIVERY','createdAt':now,'deliveryPartnerId':'partner_arun'}]
        for order in sample: self.collection('orders').document().set(order)
_db=MockDB()
def get_db(): return _db
