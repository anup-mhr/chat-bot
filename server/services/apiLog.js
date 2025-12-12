const { httpService } = require('./server.services')
const protocol = 'http'

const ApiLog = async (log) => {
    const url = `${process.env.DASHBOARD_PROTOCOL}://${process.env.DASHBOARD_SERVER}:${process.env.DASHBOARD_PORT}/rest/v1/apiLogs`
    try {
        const allowedField = ['visitorId', 'title', 'organizationId', 'apiUrl', 'type', 'category', 'description']
        const body = {
            visitorId: log.visitorId,
            organizationId: process.env.ORGANIZATION_ID,
            title: log.title,
            apiUrl: log.apiUrl,
            type: log.type,
            category: log.category,
            description: {}
        }
        const logKey = Object.keys(log).forEach((data) => {
            if (!allowedField.includes(data)) {
                body.description[data] = log[data]
            }
        })
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `${process.env.BOT_TOKEN}`
        }
        const logPost = await httpService(url, headers, 'PATCH', body)
        return logPost
    } catch (error) {
        return {}
    }
}


module.exports = {
    ApiLog
}