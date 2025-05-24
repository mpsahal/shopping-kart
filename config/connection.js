const mongoClient = require('mongodb').MongoClient;

const state = {
    db: null
};

module.exports.connect = function(done) {
    const url = 'mongodb://localhost:27017';
    const dbname = 'shopping';

    mongoClient.connect(url)
        .then(client => {
            state.db = client.db(dbname);
            done();  // Call the done callback once the connection is successful
        })
        .catch(err => {
            console.error("Error connecting to the database:", err);
            done(err);  // Pass the error to the done callback if connection fails
        });
};

module.exports.get = function() {
    return state.db;  // Return the database connection
};
