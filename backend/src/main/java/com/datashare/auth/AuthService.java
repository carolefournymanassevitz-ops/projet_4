package com.datashare.auth;

import com.datashare.auth.dto.AuthResponse;
import com.datashare.auth.dto.LoginRequest;
import com.datashare.auth.dto.RegisterRequest;
import com.datashare.security.JwtService;
import com.datashare.user.User;
import com.datashare.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public void register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email déjà utilisé");
        }
        User user = new User(request.email(), passwordEncoder.encode(request.password()));
        userRepository.save(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
            .filter(candidate -> passwordEncoder.matches(request.password(), candidate.getPasswordHash()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides"));

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, jwtService.getExpirationSeconds(), user.getId(), user.getEmail());
    }
}
