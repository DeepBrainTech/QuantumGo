// src/jwt.rs
// JWT Token验证模块 - 用于WordPress SSO单点登录
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

// JWT密钥 - 必须与WordPress端保持一致
// 从环境变量读取，如果没有设置则使用默认值（仅开发环境）
fn get_jwt_secret() -> String {
    std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production-2024".to_string())
}

/// WordPress传递过来的JWT Claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub iss: String,           // 签发者 (issuer)
    pub iat: u64,              // 签发时间 (issued at)
    pub exp: u64,              // 过期时间 (expiration)
    pub sub: u64,              // WordPress用户ID (subject)
    pub username: String,      // 用户名
    pub email: String,         // 邮箱
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>, // 显示名称
}

/// WordPress用户信息结构
#[derive(Debug, Serialize, Deserialize)]
pub struct WordPressUser {
    pub wordpress_id: u64,
    pub username: String,
    pub email: String,
}

/// 验证JWT Token
/// 
/// # Arguments
/// * `token` - JWT token字符串
/// 
/// # Returns
/// * `Ok(Claims)` - 验证成功，返回解码后的claims
/// * `Err` - 验证失败，token无效或已过期
pub fn verify_jwt_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let validation = Validation::default();
    let jwt_secret = get_jwt_secret();
    let decoding_key = DecodingKey::from_secret(jwt_secret.as_ref());
    
    let token_data = decode::<Claims>(token, &decoding_key, &validation)?;
    Ok(token_data.claims)
}

/// 创建JWT Token (如果需要后端生成token)
/// 
/// # Arguments
/// * `user` - WordPress用户信息
/// 
/// # Returns
/// * `Ok(String)` - 生成的JWT token
/// * `Err` - 生成失败
pub fn create_jwt_token(user: &WordPressUser) -> Result<String, jsonwebtoken::errors::Error> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let claims = Claims {
        iss: "QuantumGo".to_string(),
        iat: now,
        exp: now + 86400, // 24小时有效期
        sub: user.wordpress_id,
        username: user.username.clone(),
        email: user.email.clone(),
        display_name: None,
    };
    
    let jwt_secret = get_jwt_secret();
    let encoding_key = EncodingKey::from_secret(jwt_secret.as_ref());
    encode(&Header::default(), &claims, &encoding_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_token_creation_and_verification() {
        let user = WordPressUser {
            wordpress_id: 123,
            username: "testuser".to_string(),
            email: "test@example.com".to_string(),
        };

        let token = create_jwt_token(&user).unwrap();
        let claims = verify_jwt_token(&token).unwrap();

        assert_eq!(claims.sub, 123);
        assert_eq!(claims.username, "testuser");
        assert_eq!(claims.email, "test@example.com");
    }

    #[test]
    fn test_invalid_token() {
        let result = verify_jwt_token("invalid.token.here");
        assert!(result.is_err());
    }
}

