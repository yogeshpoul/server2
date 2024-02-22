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

TransactionSchema.index({ title: 'text', description: 'text' });
TransactionSchema.index({ price: 1 });

const Transaction=mongoose.model("Transaction",TransactionSchema);

app.get("/",async function(req,res){
    const response=await axios.get("https://s3.amazonaws.com/roxiler.com/product_transaction.json")
    // console.log(response);
    const data=response.data;
    // console.log(data);
    await Transaction.insertMany(data);
    res.status(200).json({ message: 'Database initialized and data stored successfully.' });
})

// app.get("/transactions",async function(req,res){
//     const { month, page = 1, perPage = 10, search } = req.query;

//     // Construct initial query based on month
//     const monthIndex = new Date(`${month} 1, 2000`).getMonth(); // Get month index (0-11)
//     console.log(search,"is ")

// // Construct initial query based on month
//     const query = month ? {
//     $expr: {
//         $eq: [{ $month: '$dateOfSale' }, monthIndex + 1] // Add 1 to monthIndex since $month operator returns 1-based month index
//     }
//     } : {};

//     // If search parameter is provided, add search conditions
//     // if (search) {
//     //   query.$or = [
//     //     { title: { $regex: search, $options: 'i' } },
//     //     { description: { $regex: search, $options: 'i' } },
//     //     { price: parseFloat(search) }
//     //   ];
//     // }
//     // if (search) {
//     //   query.$or = [
//     //     { title: { $regex: new RegExp(search, 'i') } }, // Use RegExp to create regex dynamically
//     //     { description: { $regex: new RegExp(search, 'i') } },
//     //     { price: parseFloat(search) || 0 } // Convert search to float, default to 0 if not a valid number
//     //   ];
//     // }

//     if (search) {
//       const regex = new RegExp(search, 'i'); // Case-insensitive regex pattern
//       query.$or = [
//         { title: { $regex: regex } }, // Search in titles
//         { description: { $regex: regex } }, // Search in descriptions
//         { price: parseFloat(search) || 0 } // Search in prices
//       ];
//     }
//     console.log(query)


//     // Count total number of matching transactions (for pagination)
//     const totalCount = await Transaction.countDocuments(query);

//     // Fetch transactions based on pagination and search criteria
//     const transactions = await Transaction.find(query)
//       .skip((page - 1) * perPage)
//       .limit(perPage);

//     res.json({
//       total: totalCount,
//       page: page,
//       perPage: perPage,
//       transactions: transactions
//     });
    
// })

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

app.get("/statistics",async function(req,res){
    const month = req.query.month;

    // Extract month index (0-11) from the provided month parameter
    const monthIndex = new Date(`${month} 1, 2000`).getMonth();

    // Construct aggregation pipeline to calculate statistics
    const pipeline = [
      // Match transactions for the selected month
      {
        $match: {
          $expr: { $eq: [{ $month: '$dateOfSale' }, monthIndex + 1] } // Add 1 to monthIndex since $month operator returns 1-based month index
        }
      },
      // Group transactions to calculate total sale amount and count sold/not sold items
      {
        $group: {
          _id: null,
          totalSaleAmount: { $sum: '$price' },
          totalSoldItems: { $sum: { $cond: { if: '$sold', then: 1, else: 0 } } },
          totalNotSoldItems: { $sum: { $cond: { if: '$sold', then: 0, else: 1 } } }
        }
      }
    ];

    // Execute the aggregation pipeline
    const statistics = await Transaction.aggregate(pipeline);

    // Return the statistics as JSON response
    res.json(statistics[0]);
})

app.get('/bar-chart', async (req, res) => {
    try {
      // Extract month parameter from the request query
      const month = req.query.month;
  
      // Extract month index (0-11) from the provided month parameter
      const monthIndex = new Date(`${month} 1, 2000`).getMonth();
  
      // Define price ranges
      const priceRanges = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: Infinity }
      ];
  
      // Construct aggregation pipeline to calculate bar chart data
      const pipeline = [
        // Match transactions for the selected month
        {
          $match: {
            $expr: { $eq: [{ $month: '$dateOfSale' }, monthIndex + 1] } // Add 1 to monthIndex since $month operator returns 1-based month index
          }
        },
        // Group transactions by price range and count the number of items in each range
        {
          $group: {
            _id: null,
            ranges: {
              $push: {
                $arrayElemAt: [
                  priceRanges,
                  {
                    $indexOfArray: [
                      priceRanges.map(range => ({ $and: [{ $gte: ['$price', range.min] }, { $lt: ['$price', range.max] }] })),
                      true
                    ]
                  }
                ]
              }
            }
          }
        },
        // Unwind the array of price ranges
        { $unwind: '$ranges' },
        // Group by price range and count the number of items in each range
        {
          $group: {
            _id: { min: '$ranges.min', max: '$ranges.max' },
            count: { $sum: 1 }
          }
        },
        // Project to rename _id fields and format price range
        {
          $project: {
            _id: 0,
            priceRange: {
              $concat: [
                { $toString: '$_id.min' },
                '-',
                { $cond: [{ $eq: ['$_id.max', Infinity] }, 'above', { $toString: '$_id.max' }] }
              ]
            },
            count: 1
          }
        },
        // Sort by price range
        { $sort: { priceRange: 1 } }
      ];
  
      // Execute the aggregation pipeline
      const barChartData = await Transaction.aggregate(pipeline);
  
      // Return the bar chart data as JSON response
      res.json(barChartData);
  
    } catch (error) {
      console.error('Error calculating bar chart data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });



app.get('/pie-chart', async (req, res) => {
    try {
      // Extract month parameter from the request query
      const month = req.query.month;
  
      // Extract month index (0-11) from the provided month parameter
      const monthIndex = new Date(`${month} 1, 2000`).getMonth();
  
      // Construct aggregation pipeline to calculate pie chart data
      const pipeline = [
        // Match transactions for the selected month
        {
          $match: {
            $expr: { $eq: [{ $month: '$dateOfSale' }, monthIndex + 1] } // Add 1 to monthIndex since $month operator returns 1-based month index
          }
        },
        // Group transactions by category and count the number of items in each category
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ];
  
      // Execute the aggregation pipeline
      const pieChartData = await Transaction.aggregate(pipeline);
  
      // Return the pie chart data as JSON response
      res.json(pieChartData);
  
    } catch (error) {
      console.error('Error calculating pie chart data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });


app.get('/combined-data', async (req, res) => {
  try {
    // Extract month parameter from the request query
    const month = req.query.month;

    // Array to store promises for API requests
    const apiRequests = [
      axios.get(`http://localhost:3000/transactions?month=${month}`), // Replace with your transaction API endpoint URL
      axios.get(`http://localhost:3000/statistics?month=${month}`), // Replace with your statistics API endpoint URL
      axios.get(`http://localhost:3000/bar-chart?month=${month}`), // Replace with your bar chart API endpoint URL
      axios.get(`http://localhost:3000/pie-chart?month=${month}`) // Replace with your pie chart API endpoint URL
    ];

    // Execute all API requests concurrently
    const [transactionsResponse, statisticsResponse, barChartDataResponse, pieChartDataResponse] = await Promise.all(apiRequests);

    // Combine responses into a single JSON object
    const combinedData = {
      transactions: transactionsResponse.data,
      statistics: statisticsResponse.data,
      barChartData: barChartDataResponse.data,
      pieChartData: pieChartDataResponse.data
    };

    // Return the combined data as JSON response
    res.json(combinedData);

  } catch (error) {
    console.error('Error fetching and combining data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.listen(PORT,function(){console.log(`Server is running on http://localhost:${PORT}`)})