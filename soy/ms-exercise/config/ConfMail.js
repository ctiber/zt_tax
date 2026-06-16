module.exports = {

  mailHost: process.env.EMAIL_HOST, 
  mailPort: process.env.EMAIL_SMTP_PORT, 
  mailSecure: true, 
  mailSender: process.env.EMAIL_ACCOUNT, 
  mailUser: process.env.EMAIL_ACCOUNT,
  mailPass: process.env.EMAIL_PWD,
 
  mailService: "",

 
};
