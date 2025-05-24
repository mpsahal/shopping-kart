var db = require('../config/connection');
var collection = require('../config/collections');
var ObjectId = require('mongodb').ObjectID;

function isDatabaseConnected() {
  return db.get() ? true : false;
}

module.exports = {

  addProduct: (product, callback) => {
    if (!isDatabaseConnected()) {
      console.log("Database is not connected!");
      return callback(null); // Return early if DB isn't connected
    }

    console.log('Adding product:', product);
    db.get().collection('product').insertOne(product)
      .then((data) => {
        callback(data.ops[0]._id);
      })
      .catch((err) => {
        console.error("Error adding product:", err);
        callback(null); // Return null on error
      });
  },

  getAllProducts: () => {
    return new Promise(async (resolve, reject) => {
      if (!isDatabaseConnected()) {
        return reject("Database is not connected!");
      }

      try {
        let products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray();
        resolve(products);
      } catch (err) {
        reject("Error fetching products: " + err);
      }
    });
  },

  deleteProduct: (prodId) => {
    return new Promise((resolve, reject) => {
      if (!isDatabaseConnected()) {
        return reject("Database is not connected!");
      }

      db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: ObjectId(prodId) })
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject("Error deleting product: " + err);
        });
    });
  },

  getProductDetails: (prodId) => {
    return new Promise((resolve, reject) => {
      if (!isDatabaseConnected()) {
        return reject("Database is not connected!");
      }

      db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectId(prodId) })
        .then((product) => {
          resolve(product);
        })
        .catch((err) => {
          reject("Error fetching product details: " + err);
        });
    });
  },

  updateProduct: (proId, proDetails) => {
    return new Promise((resolve, reject) => {
      if (!isDatabaseConnected()) {
        return reject("Database is not connected!");
      }

      db.get().collection(collection.PRODUCT_COLLECTION).updateOne(
        { _id: ObjectId(proId) },
        {
          $set: {
            Name: proDetails.Name,
            Description: proDetails.Description,
            Price: proDetails.Price,
            Category: proDetails.Category
          }
        }
      )
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject("Error updating product: " + err);
        });
    });
  }
};
