var express = require('express');
const productHelpers = require('../helpers/product-helpers');
var router = express.Router();
var productHelper=require('../helpers/product-helpers')

/* GET users listing. */
router.get('/', function(req, res, next) {
  productHelpers.getAllProducts().then((products)=>{
    res.render('admin/view-products',{admin:true,products})
  })

 
  
});

router.get('/add-product',function(req,res){
  res.render('admin/add-product')

})
router.post('/add-product', (req, res) => {
  console.log('Product details:', req.body);
  console.log('Uploaded file details:', req.files ? req.files.Image : 'No image uploaded');

  // If there's no file uploaded
  if (!req.files || !req.files.Image) {
    console.log('No image uploaded');
    return res.render('admin/add-product', { error: 'Please upload an image' });
  }

  // Proceed to add the product to the database
  productHelpers.addProduct(req.body, (id) => {
    let image = req.files.Image;
    
    // Check that the product ID exists
    if (!id) {
      return res.render('admin/add-product', { error: 'Failed to add product. Try again.' });
    }

    // Move the uploaded image
    image.mv('./public/product-images/' + id + '.jpg', (err) => {
      if (err) {
        console.log('Error uploading image:', err);
        return res.render('admin/add-product', { error: 'Error uploading image' });
      }
      res.render('admin/add-product', { success: 'Product added successfully!' });
    });
  });
});

router.get('/delete-product/:id',(req,res)=>{
  let proId=req.params.id
  // let proId=req.query.id
  productHelpers.deleteProduct(proId).then((response)=>{
    res.redirect('/admin/')
  })

})
router.get('/edit-product/:id',async(req,res)=>{
  let product=await productHelpers.getProductDetails(req.params.id)
  res.render('admin/edit-product',{product})
})
router.post('/edit-product/:id',(req,res)=>{
  productHelpers.updateProduct(req.params.id,req.body).then(()=>{
    res.redirect('/admin')
    if(req.files.Image){
      let image=req.files.Image
      image.mv('./public/product-images/'+req.params.id+'.jpg')
    }
  })
})

module.exports = router;