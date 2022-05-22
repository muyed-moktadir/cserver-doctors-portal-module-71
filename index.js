const express = require("express");
const app = express();
const jwt = require('jsonwebtoken'); /*(75.3)*/
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 5000;

// MiddleTire
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sfgvq.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

/*verify jwt token 75.5*/ 
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}



async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");

  

    // TODO:get all users show in dashboard all users and use verify jwt(75.7) for safety (75.6) 
    app.get('/user',verifyJWT, async (req,res)=>{
      const users = await userCollection.find().toArray();
      res.send(users);
    })
      
    
    // TODO:user admin na hole route tai dekhabe sei user  er role check er kaj(75.8)
    app.get('/admin/:email', async(req, res) =>{
      const email = req.params.email;
      console.log(email);
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin})
    })


    // TODO: Create API to Make user an Admin(75.7,75.8)
    app.put('/user/admin/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;
      /*75.8*/ 
      const requester = req.decoded.email;
      /**/ 
      const requesterAccount = await userCollection.findOne({ email: requester });
      if(requesterAccount.role==='admin'){

        const filter = { email: email };
        const updateDoc = {
          $set: {role:'admin'},
        };
        const result = await userCollection.updateOne(filter, updateDoc);
  
        /*generate a token send to usetoken hook(75.3)*/
  
        res.send({result});
      }
      else{
        res.status(403.).send({message:'forbidden'})
      }
 
    
    })



    // TODO: add user in user collection jwt token(75.1,75.3)
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      /*email diye dekhbo user ase kina*/
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);

      /*generate a token send to usetoken hook(75.3)*/
       const token = jwt.sign({email:email},process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({result, token});
    })



    // TODO:get all service 
    app.get('/service' , async (req,res)=>{
      const query ={};
      const cursor = serviceCollection.find(query)
      const services = await cursor.toArray()
      res.send(services)
    })



    // TODO: get Available date oi date bade onno date gulo jevabe pabo
    app.get('/available', async(req,res)=>{
      const date = req.query.date;

      // TODO:step 1: get all services
      const services = await serviceCollection.find().toArray();

      //TODO:step 2: get the booking of that day output :[{},{},{},{},{},{}]
      const query = {date:date}
      const bookings = await bookingCollection.find(query).toArray();

      //TODO: step 3: for each service
      services.forEach(service => {

         // step 4: find bookings for that service [{},{},{},{}]
      const serviceBookings = bookings.filter(book=>book.treatment===service.name)
     
      // step 5: select slots for the service bookings .['','','','']
      const bookedSlots = serviceBookings.map(book =>book.slot);
      
      // step 6: select those slots that are not in bookedSlots
      const available = service.slots.filter(slot=> !bookedSlots.includes(slot))
     
      // step 7: set available to slots to make it easier
      service.slots= available;
      });
     
      res.send(services);
    })



     /**
      *API NAMING CONVENTION
      *app.get('/booking') // get all booking in this collection or get more than one or by filter
      *  app.get('/booking/:id') // get a specific booking
      *  app.post('/booking') // add a new booking
      *  app.patch('/booking/:id') //
      *  app.delete('/booking/:id') // 
      */ 

    


      // TODO:get all bookings by email then verify jwt (74.8) (75.5)
    app.get('/booking',verifyJWT, async(req,res)=>{
      // email take nicchi
      const patient = req.query.patient;
      // TODO:query korbo email diye "patient" (74.8)
      // const query = {patient:patient}
      // const bookings = await bookingCollection.find(query).toArray();
      // res.send(bookings)

      /*TODO:for jwt token*/
      const decodedEmail=req.decoded.email;
      if(patient===decodedEmail){
        const query = {patient:patient}
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings)
      }
      else{
        return res.status(403).send({message:'forbidden access'})
      }  
   
   
    })
    



      //TODO: add a booking in database (74.2)
    app.post('/booking', async (req,res)=>{

      /*post er data thake body er moddhe. booking er data ta er req ashtese client theke */
      const booking = req.body; 
      const query = {treatment: booking.treatment,date:booking.date,patient:booking.patient};

      /*then data base  a query diye find korbe (74.3)*/ 
      const exists = await bookingCollection.findOne(query);
      if(exists){
        return res.send({success:false,booking:exists})
      }

      const result = await bookingCollection.insertOne(booking);
      return res.send({success:true, result});
    })



  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Doctors Portal");
});

app.listen(port, () => {
  console.log(`listening on Doctors Portal port: ${port}`);
});
