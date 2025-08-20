import React from "react";
import swal from "sweetalert";
import { Button, TextField, Link } from "@mui/material";
import { withRouter } from "./utils";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2000';

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      password: ''
    };
  }

  onChange = (e) => this.setState({ [e.target.name]: e.target.value });

  login = () => {
    axios.post(`${API_BASE_URL}/login`, {
      username: this.state.username,
      password: this.state.password
    }).then((res) => {
      // Clear previous session data
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user_id');
      sessionStorage.removeItem('dashboardState');
  
      // Store new session data
      sessionStorage.setItem('token', res.data.token);
  
      // Set the Authorization header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
  
      // Show success message
      swal({
        text: res.data.message || "Login successful!",
        icon: "success",
      });
  
      // Navigate to the dashboard
      this.props.navigate("/dashboard");
    }).catch((err) => {
      if (err.response && err.response.data && err.response.data.errorMessage) {
        swal({
          text: err.response.data.errorMessage,
          icon: "error",
        });
      } else {
        swal({
          text: "Login failed. Please try again.",
          icon: "error",
        });
      }
    });
  }

  render() {
    return (
      <div style={{ marginTop: '200px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ border: '5px solid #4CAF50', padding: '20px', borderRadius: '10px', width: '300px' }}>
          <div>
            <h2>Login</h2>
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
              fullWidth
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
              fullWidth
            />
            <br /><br />
            <Button
             className="button_style"
             variant="contained"
             style={{ backgroundColor: '#4CAF50', color: 'white' }} // Custom color
             size="small"
              disabled={this.state.username === '' || this.state.password === ''}
              onClick={this.login}
              fullWidth
            >
              Login
            </Button>
            <br /><br />
            <Link
              component="button"
              style={{ fontFamily: "inherit", fontSize: "inherit", color: '#4CAF50'}}
              onClick={() => {
                this.props.navigate("/register");
              }}
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(Login);