const express = require("express");
const cors = require("cors");
const clientRoutes = require("./routes/clients");
const listingRoutes = require("./routes/listings");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("CBE QuickSite backend is running");
});

app.use("/clients", clientRoutes);
app.use("/listings", listingRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});