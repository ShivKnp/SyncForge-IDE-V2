import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, message, notification } from 'antd';
import { FiUser, FiLock, FiUserPlus } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            return message.error('Please fill in all fields.');
        }
        if (password.length < 6) {
            return message.error('Password must be at least 6 characters long.');
        }
        setLoading(true);
        try {
            await register(username, password);
            notification.success({
                message: 'Registration Successful',
                description: `Welcome to SyncForge, ${username}!`,
            });
            navigate('/dashboard');
        } catch (err) {
            const errorMsg = err.response?.data?.msg || 'Registration failed. Please try another username.';
            message.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-800/40 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
                <div className="text-center mb-8">
                     <div className="inline-block bg-gradient-to-br from-violet-600 to-cyan-400 text-white font-extrabold rounded-lg px-4 py-2 shadow-lg mb-4">
                        SF
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Create an Account</h1>
                    <p className="text-slate-400 mt-2">Join SyncForge to save and resume your sessions</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                    <div>
                        <Input
                            size="large"
                            placeholder="Choose a username"
                            prefix={<FiUser className="text-slate-400" />}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="bg-slate-800/60 !text-white border-slate-700 hover:border-slate-600 focus:border-cyan-500"
                        />
                    </div>
                    <div>
                        <Input.Password
                            size="large"
                            placeholder="Create a password"
                            prefix={<FiLock className="text-slate-400" />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-slate-800/60 !text-white border-slate-700 hover:border-slate-600 focus:border-cyan-500"
                        />
                    </div>
                    <div>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={loading}
                            icon={<FiUserPlus />}
                            className="w-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold border-0 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:brightness-110"
                        >
                            Sign Up
                        </Button>
                    </div>
                </form>

                <div className="mt-6 text-center text-slate-400">
                    <p>
                        Already have an account?{' '}
                        <Link to="/login" className="font-medium text-cyan-400 hover:text-cyan-300">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
