import React from "react";
import swal from "sweetalert";
import { Button, TextField, Link } from "@mui/material";
import { withRouter } from "./utils";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2000';

class Register extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      password: '',
      confirm_password: ''
    };
  }

  onChange = (e) => this.setState({ [e.target.name]: e.target.value });

  register = () => {
    if (this.state.password !== this.state.confirm_password) {
      swal({
        text: "Passwords do not match",
        icon: "error",
        type: "error"
      });
      return;
    }

    if (this.state.username.trim() === '') {
      swal({
        text: "Username cannot be empty",
        icon: "error",
        type: "error"
      });
      return;
    }

    axios.post(`${API_BASE_URL}/register`, {
      username: this.state.username.trim(),
      password: this.state.password,
    }).then((res) => {
      swal({
        text: res.data.message,
        icon: "success",
        type: "success"
      });
      this.props.navigate("/");
    }).catch((err) => {
      const errorMessage = err.response?.data?.errorMessage || "Registration failed. Please try again.";
      swal({
        text: errorMessage,
        icon: "error",
        type: "error"
      });
    });
  }

  render() {
    return (
      <div style={{ marginTop: '200px', display: 'flex', justifyContent: 'center', }}>
        <div style={{ border: '5px solid #4CAF50', padding: '20px', borderRadius: '10px', width: '300px' }}>
          <div>
            <h2>Register</h2>
          </div>

          <div>
            <TextField
              id="standard-basic"
              type="text"
              autoComplete="off"
              name="username"
              value={this.state.username}
              onChange={this.onChange}
              placeholder="User Name"
              required
            />
            <br /><br />
            <TextField
              id="standard-basic"
              type="password"
              autoComplete="off"
              name="password"
              value={this.state.password}
              onChange={this.onChange}
              placeholder="Password"
              required
            />
            <br /><br />
            <TextField
              id="standard-basic"
              type="password"
              autoComplete="off"
              name="confirm_password"
              value={this.state.confirm_password}
              onChange={this.onChange}
              placeholder="Confirm Password"
              required
            />
            <br /><br />
            <Button
              className="button_style"
              variant="contained"
              style={{ backgroundColor: '#4CAF50', color: 'white' }} // Custom color
              size="small"
              disabled={this.state.username === '' || this.state.password === '' || this.state.confirm_password === ''}
              onClick={this.register}
            >
              Register
            </Button>
            <br /><br />
            <Link
              component="button"
              style={{ fontFamily: "inherit", fontSize: "inherit", color: '#4CAF50' }}
              onClick={() => {
                this.props.navigate("/");
              }}
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(Register);
