var db = require('../config/connection');
var collection = require('../config/collections');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const Razorpay = require('razorpay');

var instance = new Razorpay({
  key_id: 'rzp_test_Wlja71Ph69DNOp',
  key_secret: 'zRK1seNVmabRzHA6Sofpj0uI',
});

module.exports = {
  doSignup: (userData) => {
    return new Promise(async (resolve, reject) => {
      try {
        userData.Password = await bcrypt.hash(userData.Password, 10);
        const data = await db.get().collection(collection.USER_COLLECTION).insertOne(userData);
        resolve(data.insertedId);  // Changed from ops[0] to insertedId
      } catch (err) {
        reject("Error during sign up:", err);
      }
    });
  },

  doLogin: (userData) => {
    return new Promise(async (resolve, reject) => {
      try {
        let response = {};
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email });
        if (user) {
          let status = await bcrypt.compare(userData.Password, user.Password);
          if (status) {
            response.user = user;
            response.status = true;
            resolve(response);
          } else {
            resolve({ status: false });
          }
        } else {
          resolve({ status: false });
        }
      } catch (err) {
        reject("Error during login:", err);
      }
    });
  },

  addToCart: (proId, userId) => {
    let proObj = {
      item: new ObjectId(proId),
      quantity: 1,
    };
    return new Promise(async (resolve, reject) => {
      try {
        let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) });
        if (userCart) {
          let proExist = userCart.products.findIndex(product => product.item == proId);
          if (proExist != -1) {
            await db.get().collection(collection.CART_COLLECTION).updateOne(
              { user: new ObjectId(userId), 'products.item': new ObjectId(proId) },
              { $inc: { 'products.$.quantity': 1 } }
            );
            resolve();
          } else {
            await db.get().collection(collection.CART_COLLECTION).updateOne(
              { user: new ObjectId(userId) },
              { $push: { products: proObj } }
            );
            resolve();
          }
        } else {
          let cartObj = {
            user: new ObjectId(userId),
            products: [proObj],
          };
          await db.get().collection(collection.CART_COLLECTION).insertOne(cartObj);
          resolve();
        }
      } catch (err) {
        reject("Error adding product to cart:", err);
      }
    });
  },

  getCartProducts: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
          { $match: { user: new ObjectId(userId) } },
          { $unwind: '$products' },
          {
            $project: {
              item: '$products.item',
              quantity: '$products.quantity',
            }
          },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: 'item',
              foreignField: '_id',
              as: 'product',
            }
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ['$product', 0] },
            }
          },
        ]).toArray();
        resolve(cartItems);
      } catch (err) {
        reject("Error getting cart products:", err);
      }
    });
  },

  getCartCount: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let count = 0;
        let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) });
        if (cart) {
          count = cart.products.length;
        }
        resolve(count);
      } catch (err) {
        reject("Error getting cart count:", err);
      }
    });
  },

  changeProductQuantity: (details) => {
    details.count = parseInt(details.count);
    details.quantity = parseInt(details.quantity);
    return new Promise(async (resolve, reject) => {
      try {
        if (details.count == -1 && details.quantity == 1) {
          await db.get().collection(collection.CART_COLLECTION).updateOne(
            { _id: new ObjectId(details.cart) },
            { $pull: { products: { item: new ObjectId(details.product) } } }
          );
          resolve({ removeProduct: true });
        } else {
          await db.get().collection(collection.CART_COLLECTION).updateOne(
            { _id: new ObjectId(details.cart), 'products.item': new ObjectId(details.product) },
            { $inc: { 'products.$.quantity': details.count } }
          );
          resolve({ status: true });
        }
      } catch (err) {
        reject("Error changing product quantity:", err);
      }
    });
  },

  getTotalAmount: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
          { $match: { user: new ObjectId(userId) } },
          { $unwind: '$products' },
          {
            $project: {
              item: '$products.item',
              quantity: '$products.quantity',
            }
          },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: 'item',
              foreignField: '_id',
              as: 'product',
            }
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ['$product', 0] },
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $multiply: ['$quantity', '$product.Price'] } }
            }
          }
        ]).toArray();
        resolve(total[0]?.total || 0); // Added a fallback value of 0 for total
      } catch (err) {
        reject("Error calculating total amount:", err);
      }
    });
  },

  placeOrder: (order, products, total) => {
    return new Promise(async (resolve, reject) => {
      try {
        let status = order['payment-method'] === 'COD' ? 'placed' : 'pending';
        let orderObj = {
          deliveryDetails: {
            mobile: order.mobile,
            address: order.address,
            pincode: order.pincode,
          },
          userId: new ObjectId(order.userId),
          paymentmethod: order['payment-method'],
          products: products,
          totalAmount: total,
          status: status,
          date: new Date(),
        };
        const response = await db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj);
        await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new ObjectId(order.userId) });
        resolve(response.insertedId); // Changed from ops[0]._id to insertedId
      } catch (err) {
        reject("Error placing order:", err);
      }
    });
  },

  getCartProductList: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) });
        resolve(cart?.products || []); // Added fallback to empty array
      } catch (err) {
        reject("Error getting cart product list:", err);
      }
    });
  },

  getUserOrders: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let orders = await db.get().collection(collection.ORDER_COLLECTION).find({ userId: new ObjectId(userId) }).toArray();
        resolve(orders);
      } catch (err) {
        reject("Error fetching user orders:", err);
      }
    });
  },

  getOrderproducts: (orderId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
          { $match: { _id: new ObjectId(orderId) } },
          { $unwind: '$products' },
          {
            $project: {
              item: '$products.item',
              quantity: '$products.quantity',
            }
          },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: 'item',
              foreignField: '_id',
              as: 'product',
            }
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ['$product', 0] },
            }
          }
        ]).toArray();
        resolve(orderItems);
      } catch (err) {
        reject("Error fetching order products:", err);
      }
    });
  },

  generateRazorpay: (orderId, total) => {
    return new Promise((resolve, reject) => {
      try {
        var options = {
          amount: total * 100, // amount in the smallest currency unit
          currency: "INR",
          receipt: "" + orderId,
        };
        instance.orders.create(options, function (err, order) {
          if (err) {
            reject("Error creating Razorpay order:", err);
          } else {
            resolve(order);
          }
        });
      } catch (err) {
        reject("Error generating Razorpay payment:", err);
      }
    });
  },

  verifyPayment: (details) => {
    return new Promise((resolve, reject) => {
      try {
        const crypto = require('crypto');
        let hmac = crypto.createHmac('sha256', 'zRK1seNVmabRzHA6Sofpj0uI');
        hmac.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]']);
        hmac = hmac.digest('hex');
        if (hmac === details['payment[razorpay_signature]']) {
          resolve();
        } else {
          reject("Payment verification failed");
        }
      } catch (err) {
        reject("Error verifying payment:", err);
      }
    });
  },

  changePaymentStatus: (orderId) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.get().collection(collection.ORDER_COLLECTION).updateOne(
          { _id: new ObjectId(orderId) },
          { $set: { status: 'placed' } }
        );
        resolve();
      } catch (err) {
        reject("Error changing payment status:", err);
      }
    });
  }
};



// getCartProducts:(userId)=>{
//     return new Promise(async(resolve,reject)=>{
//         let cartItems=await db.get().collection(collection.CART_COLLECTION).aggregate([
//            { $match:{user:ObjectId(userId)}},
//            {
//                $lookup:{
//                    from:collection.PRODUCT_COLLECTION,
//                    let:{prodList:'$products'},
//                    pipeline:[{

//                       $match:{
//                           $expr:{
//                               $in:['$_id',"$$prodList"]
                             
//                           }
//                       }

//                    }],
//                    as:'cartItems'
//                }
//            }
//         ]).toArray()
//         resolve(cartItems[0].cartItems)
//     })
// },