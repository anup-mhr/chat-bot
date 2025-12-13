const baseUrl = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}`;

const catchAsync = require("../utils/catchAsync");
const serverServices = require("../services/server.services");

const loggerModule = require("../logger/main");

exports.getVisitors = catchAsync(async function (req, res) {
  const url = `${process.env.CONTROL_PANEL_PROTOCOL}://${process.env.CONTROL_PANEL_URL}/api/visitors/get-visitor-list-liveChat?client=${req.query.org_id}&branch_id=${req.query.branch_id}&date_range=${req.query.range}&perpage=100`;
  // req.query.branch_id
  //   ? url.searchParams.append("branches", req.query.branch_id)
  //   : url.searchParams.append("regions", req.query.region_id);
  const panelKey = process.env.CONTROL_PANEL_KEY;

  let headers = {
    "Content-Type": "application/json",
    apikey: panelKey,
    authorization: `Bearer ${req.query.token}`,
  };

  // const urls = `${baseUrl}/${process.env.BASEPATH}/visitors/source?organizationId=${
  //   process.env.ORGANIZATION_ID
  // }&source=${req.query.source}&duration=${req.query.duration}&filter={"page":${
  //   req.query.start
  // }, "limit":500}&access_token=${req.headers.authorization || req.query.accessToken}`;

  const response = await serverServices.getFromServer(url, headers);

  const data = await response.json();

  const visitors = data?.data?.data || [];

  const uniqueVisitorsObj = visitors.reduce((acc, visitor) => {
    const userId = visitor.user_id;
    const hasDetails = Object.keys(visitor.clientDetails || {}).length > 0;

    if (!acc[userId]) {
      acc[userId] = visitor;
    } else {
      const existingHasDetails =
        Object.keys(acc[userId].clientDetails || {}).length > 0;
      if (!existingHasDetails && hasDetails) {
        acc[userId] = visitor;
      }
    }

    return acc;
  }, {});

  const uniqueVisitors = Object.values(uniqueVisitorsObj);

  const filteredData = {
    data: {
      data: uniqueVisitors,
      count: uniqueVisitors.length,
      limit: data?.data?.limit ?? 100,
    },
  };
  res.status(response.status).json({ data: filteredData });
});

exports.getVisitorCount = catchAsync(async function (req, res) {
  const url = `${baseUrl}/visitors/count?`;
  if (req.query.hasOwnProperty("start-date")) {
    url += `&lastactivity_gte=${req.query["start-date"]}`;
  }
  if (req.query.hasOwnProperty("end-date")) {
    url += `&lastactivity_lte=${req.query["end-date"]}`;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${req.headers.bearer}`,
  };

  const response = await serverServices.getFromServer(url, headers);

  const data = await response.json();

  res.status(response.status).json({ data });
});
