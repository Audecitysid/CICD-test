const { z } = require("zod");

const verifyEmailValidation = (data, res) => {
  const user = z
    .object({
      verifyCode: z.string().refine((code) => code.length === 6, {
        message: "Verification code must be 6 digits",
        path: ["verifyCode"],
      }),
    })
    .required();

  try {
    user.parse(data);
  } catch (error) {
    return res.status(400).json({ message: error.issues[0] });
  }
};

const registerValidation = (data, res) => {
  const user = z
    .object({
      username: z.string().min(2),
      email: z.string().min(6).email(),
      password: z.string().min(8),
    })
    .required();

  try {
    user.parse(data);
  } catch (error) {
    return res.status(400).json({ message: error.issues[0] });
  }
};

const loginValidation = (data, res) => {
  const user = z
    .object({
      email: z.string().min(6).email(),
      password: z.string().min(8),
    })
    .required();

  try {
    user.parse(data);
  } catch (error) {
    return res.status(400).json({ message: error.issues[0] });
  }
};

const resetPasswordValidation = (data, res) => {
  const user = z
    .object({
      password: z.string().min(8),
    })
    .required();

  try {
    user.parse(data);
  } catch (error) {
    return res.status(400).json({ message: error.issues[0] });
  }
};

module.exports.registerValidation = registerValidation;
module.exports.loginValidation = loginValidation;
module.exports.verifyEmailValidation = verifyEmailValidation;
module.exports.resetPasswordValidation = resetPasswordValidation;
