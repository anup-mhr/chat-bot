exports.successResponse = async (res, data, type, status, statusCode) => {
  return res.status(statusCode).json({
    for: type,
    status: status,
    data: data,
  });
};
