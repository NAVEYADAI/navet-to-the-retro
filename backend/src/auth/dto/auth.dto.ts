export class RegisterDto {
  username?: string;
  email!: string;
  password!: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export class LoginDto {
  username!: string;
  password!: string;
}

export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  email?: string;
}
