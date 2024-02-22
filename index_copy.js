const express=require("express");
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;
const cors=require("cors");

app.use(cors());

const mongoose=require("mongoose");
const { default: axios } = require("axios");

mongoose.connect("mongodb://localhost:27017/server2");

const TransactionSchema=new mongoose.Schema({
    id:Number,
    title:String,
    price:Number,
    description:String,
    category:String,
    image:String,
    sold:Boolean,
    dateOfSale:Date
})

const Transaction=mongoose.model("Transaction",TransactionSchema);
TransactionSchema.index({ title: 'text', description: 'text' });
TransactionSchema.index({ price: 1 });

app.get("/",async function(req,res){
    const response=await axios.get("https://s3.amazonaws.com/roxiler.com/product_transaction.json")
    // console.log(response);
    const data=response.data;
    // console.log(data);
    await Transaction.insertMany(data);
    res.status(200).json({ message: 'Database initialized and data stored successfully.' });
})



app.get("/transactions",async function(req,res){
    const { month, page = 1, perPage = 10, search } = req.query;

    console.log(search,"is ")

    const monthIndex = new Date(`${month} 1, 2000`).getMonth();

    const query = month ? {
      $expr: {
          $eq: [{ $month: '$dateOfSale' }, monthIndex + 1] // Add 1 to monthIndex since $month operator returns 1-based month index
      }
      } : {};

    if(search){
      query.$or = [{ $text: { $search: search } },
        { price: parseFloat(search) || 0 }];
    }

      const totalCount = await Transaction.countDocuments(query);

      // Fetch transactions based on pagination and search criteria
      const transactions = await Transaction.find(query)
        .skip((page - 1) * perPage)
        .limit(perPage);
  
      res.json({
        total: totalCount,
        page: page,
        perPage: perPage,
        transactions: transactions
      });
    
})


app.listen(PORT,function(){console.log(`Server is running on http://localhost:${PORT}`)})