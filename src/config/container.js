const UserRepository = require('../repositories/UserRepository');
const CategoryRepository = require('../repositories/CategoryRepository');
const ProductRepository = require('../repositories/ProductRepository');
const CartRepository = require('../repositories/CartRepository');
const WishlistRepository = require('../repositories/WishlistRepository');
const OrderRepository = require('../repositories/OrderRepository');
const ReviewRepository = require('../repositories/ReviewRepository');
const CouponRepository = require('../repositories/CouponRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const PasswordResetTokenRepository = require('../repositories/PasswordResetTokenRepository');

const EmailService = require('../services/EmailService');
const InvoiceService = require('../services/InvoiceService');
const AuthService = require('../services/AuthService');
const UserService = require('../services/UserService');
const CategoryService = require('../services/CategoryService');
const ProductService = require('../services/ProductService');
const CartService = require('../services/CartService');
const WishlistService = require('../services/WishlistService');
const OrderService = require('../services/OrderService');
const ReviewService = require('../services/ReviewService');
const CouponService = require('../services/CouponService');
const DashboardService = require('../services/DashboardService');
const UploadService = require('../services/UploadService');
const PaymentService = require('../services/PaymentService');

const userRepository = new UserRepository();
const categoryRepository = new CategoryRepository();
const productRepository = new ProductRepository();
const cartRepository = new CartRepository();
const wishlistRepository = new WishlistRepository();
const orderRepository = new OrderRepository();
const reviewRepository = new ReviewRepository();
const couponRepository = new CouponRepository();
const inventoryRepository = new InventoryRepository();
const passwordResetTokenRepository = new PasswordResetTokenRepository();

const emailService = new EmailService();
const invoiceService = new InvoiceService();
const authService = new AuthService({ userRepository, passwordResetTokenRepository, emailService });
const userService = new UserService({ userRepository });
const categoryService = new CategoryService({ categoryRepository });
const productService = new ProductService({ productRepository, categoryRepository });
const couponService = new CouponService({ couponRepository });
const cartService = new CartService({ cartRepository, productRepository, couponService });
const wishlistService = new WishlistService({ wishlistRepository, productRepository });
const paymentService = new PaymentService();
const orderService = new OrderService({
  cartRepository,
  productRepository,
  orderRepository,
  inventoryRepository,
  couponService,
  emailService,
  invoiceService,
  paymentService,
});
const reviewService = new ReviewService({ reviewRepository, productRepository });
const dashboardService = new DashboardService({
  userRepository,
  productRepository,
  categoryRepository,
  orderRepository,
  inventoryRepository,
  couponRepository,
});
const uploadService = new UploadService();

module.exports = {
  userRepository,
  categoryRepository,
  productRepository,
  cartRepository,
  wishlistRepository,
  orderRepository,
  reviewRepository,
  couponRepository,
  inventoryRepository,
  passwordResetTokenRepository,
  emailService,
  invoiceService,
  authService,
  userService,
  categoryService,
  productService,
  cartService,
  wishlistService,
  orderService,
  reviewService,
  couponService,
  dashboardService,
  uploadService,
  paymentService,
};
