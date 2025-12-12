const data = require("../localDataJson/branch.json");
const radius = process.env.RADIUS || 10;
const unit = process.env.UNIT || 'K';

function getDistance(lat1, lon1, lat2, lon2, unit) {
    var radlat1 = Math.PI * lat1/180
    var radlat2 = Math.PI * lat2/180
    var theta = lon1-lon2
    var radtheta = Math.PI * theta/180
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
        dist = 1;
    }
    dist = Math.acos(dist)
    dist = dist * 180/Math.PI
    dist = dist * 60 * 1.1515
    if (unit=="K") { dist = dist * 1.609344 }
    if (unit=="N") { dist = dist * 0.8684 }
    return dist
}


const getBranches = (lat, lng) => {
    
    let branches = [];
    data.forEach(branch => {
        let lat_lng = branch.Column2.split(",");
        let [lat1, lng1] = lat_lng;
        let distance = getDistance(lat, lng, lat1, lng1, unit);
        // console.log(distance,"distance");
        if (distance <= radius) {
            branches.push({
                Name: branch.BRANCHES,
                latitude: lat1,
                longitude: lng1
            });
        }
    }
    );
    return branches;
}

module.exports = {
    getBranches
}