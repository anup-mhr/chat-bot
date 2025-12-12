const catchAsync = require('../utils/catchAsync');
const ServerServices = require('../services/server.services');
const AppError = require('../utils/appError');

exports.getToken = catchAsync(async (req,res, next) => {
    let url = `${process.env.RELIABLE_BASE_URL}/auth/token`;
    let bodyData = {
        identifier : process.env.IDENTIFIER,
        username : process.env.USER_NAME,
        password : process.env.PASSWORD
    }
    let headers = {
        'Content-Type': 'application/json'
    }
    let response = await ServerServices.postToServer(url,bodyData,headers);
    if(response.status === 200){
        let data = await response.json();
        let token = data.tokenType + ' ' + data.token;
        req.headers.token = token;
        next();
    }
    else{
        return next(new AppError('Something went wrong',500));
    }
})

