const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

/**
 * Middleware to validate request data
 */
const validate = (schema) => (req, res, next) => {
  try {
    const validatedData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Gán lại dữ liệu đã xác thực
    req.body = validatedData.body;
    req.query = validatedData.query;
    req.params = validatedData.params;
    
    next();
  } catch (error) {
    let errorMessage = 'Dữ liệu không hợp lệ.';
    
    try {
      let errorList = [];
      
      // Xử lý an toàn: gom lỗi về một mảng bất kể format của thư viện
      if (Array.isArray(error.errors)) {
        errorList = error.errors;
      } else if (Array.isArray(error.details)) {
        errorList = error.details; // Dành cho Joi
      } else if (typeof error.message === 'string') {
        try {
          // Thử parse nếu error.message là chuỗi JSON mảng lỗi
          const parsed = JSON.parse(error.message);
          if (Array.isArray(parsed)) errorList = parsed;
        } catch (e) {
          // Không phải chuỗi JSON thì bỏ qua
        }
      }

      // Nếu lấy được danh sách lỗi, map ra tiếng Việt
      if (errorList.length > 0) {
        const errorMessages = errorList.map((err) => {
          const path = Array.isArray(err.path) ? err.path.join('.') : String(err.path || '');
          const msg = String(err.message || '').toLowerCase();
          
          if (path.includes('email') || msg.includes('email')) return 'Email không đúng định dạng.';
          if (path.includes('password') || msg.includes('password')) return 'Mật khẩu chưa đủ mạnh (cần ít nhất 6 ký tự).';
          if (path.includes('username') || msg.includes('username')) return 'Tên đăng nhập không hợp lệ.';
          if (path.includes('fullname') || msg.includes('fullname')) return 'Họ và tên không hợp lệ.';
          
          return err.message;
        });
        
        // Loại bỏ thông báo trùng lặp
        errorMessage = [...new Set(errorMessages)].join(' ');
      } else {
        errorMessage = error.message || 'Xác thực dữ liệu thất bại.';
      }
    } catch (err) {
      // Bắt lỗi dự phòng trường hợp map() vẫn có vấn đề
      errorMessage = 'Định dạng dữ liệu đầu vào không hợp lệ.';
    }

    return next(new ApiError(400, errorMessage, ERROR_CODES.VALIDATION.VALIDATION_ERROR));
  }
};

module.exports = validate;