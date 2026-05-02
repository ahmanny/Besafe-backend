
export interface LoginPayloadInterface {
    email: string
    password: string
}
export interface OtpverifyPayloadInterface {
    email: string
    otpcode: string
}
export interface SignupPayloadInterface {
    name: string
    email: string
    password: string
}
export interface forgottenPasswordPayloadInterface {
    email: string
}
export interface passwordResetPayloadInterface {
    token: string
    password: string
}
