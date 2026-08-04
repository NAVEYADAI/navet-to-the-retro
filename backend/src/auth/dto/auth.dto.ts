export class RegisterDto {
  username!: string;
  email!: string;
  password!: string;
  firstName?: string;
  lastName?: string;
  teamName?: string;
}

export class LoginDto {
  username!: string;
  password!: string;
}
