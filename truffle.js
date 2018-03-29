module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 8545,
            network_id: "*" // Match any network id
        },
        ropsten: {
            host: "localhost",
            port: 8546,
            network_id: "3"
        },
        live: {
            host: "http://192.168.88.204",
            port: 8545,
            network_id: "1"
        }
    }
};
