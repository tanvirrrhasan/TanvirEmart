# Tanvir E-Mart Development Guide

## Project Overview

Tanvir E-Mart is a modern e-commerce web application built with HTML, CSS, and JavaScript, featuring Firebase integration for backend services.

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Firestore, Authentication, Storage, Hosting)
- **Deployment**: Vercel, Firebase Hosting
- **Version Control**: Git

## Project Structure

```
TanvirEmart/
├── .github/workflows/          # GitHub Actions for CI/CD
├── .vscode/                   # VS Code settings
├── account/                   # User account management
├── cart/                      # Shopping cart functionality
├── category/                  # Category-specific pages
├── checkout/                  # Checkout process
├── components/                # Reusable UI components
├── home/                      # Home page components
├── product/                   # Product details pages
├── search/                    # Search functionality
├── app.js                     # Main application logic
├── firebase-config.js         # Firebase configuration
├── firebase.json             # Firebase hosting config
├── .firebaserc               # Firebase project config
├── index.html                # Main entry point
├── style.css                 # Global styles
├── README.md                 # Project documentation
├── DEVELOPMENT.md            # This development guide
└── website_features.txt      # Feature documentation
```

## Key Features

### 1. Home Page (`index.html`, `app.js`)
- Dynamic banner carousel
- Product grid with filtering and sorting
- Category navigation
- Search functionality with suggestions
- Mobile-responsive design
- Bottom navigation

### 2. Product Pages (`product/`)
- Detailed product information
- Image galleries
- Add to cart functionality
- Product variants
- Stock status
- Warranty information

### 3. Shopping Cart (`cart/`)
- Cart item management
- Quantity adjustments
- Price calculations
- Local storage persistence
- Checkout integration

### 4. Checkout Process (`checkout/`)
- Delivery address form
- Order summary
- Payment options
- Order confirmation

### 5. User Account (`account/`)
- Google authentication
- Profile management
- Order history
- Order status tracking

## Development Setup

### Prerequisites
- Node.js (for Firebase CLI)
- Git
- VS Code (recommended)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/tanvirrrhasan/TanvirEmart.git
   cd TanvirEmart
   ```

2. **Install Firebase CLI** (optional, for local development)
   ```bash
   npm install -g firebase-tools
   ```

3. **Firebase Setup**
   ```bash
   firebase login
   firebase use tanviremart
   ```

4. **Local Development**
   - Use VS Code Live Server extension
   - Or serve with any local server
   - Default port: 5502 (configured in .vscode/settings.json)

## Firebase Configuration

### Project Details
- **Project ID**: tanviremart
- **Auth Domain**: tanviremart.firebaseapp.com
- **Storage Bucket**: tanviremart.firebasestorage.app

### Services Used
- **Firestore**: Product and order data
- **Authentication**: Google sign-in
- **Storage**: Product images
- **Hosting**: Web application hosting

## Development Guidelines

### Code Style
- Use ES6+ JavaScript features
- Follow consistent naming conventions
- Comment complex logic
- Use meaningful variable names

### File Organization
- Keep related files together
- Use descriptive file names
- Separate concerns (HTML, CSS, JS)
- Maintain consistent structure across directories

### Responsive Design
- Mobile-first approach
- Test on multiple screen sizes
- Use CSS Grid and Flexbox
- Optimize for touch interactions

### Performance
- Optimize images
- Minimize HTTP requests
- Use efficient DOM queries
- Implement lazy loading where appropriate

## Deployment

### Firebase Hosting
- Automatic deployment via GitHub Actions
- Manual deployment: `firebase deploy`
- Preview deployments: `firebase deploy --only hosting:preview`

### Vercel Deployment
- Connected to GitHub repository
- Automatic deployments on push to main branch
- Custom domain: tanviremart.vercel.app

## Testing

### Manual Testing Checklist
- [ ] Home page loads correctly
- [ ] Product search works
- [ ] Cart functionality
- [ ] Checkout process
- [ ] User authentication
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

### Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Troubleshooting

### Common Issues

1. **Firebase Connection Errors**
   - Check API keys in firebase-config.js
   - Verify project ID matches
   - Ensure Firebase services are enabled

2. **CORS Issues**
   - Check Firebase hosting configuration
   - Verify domain settings

3. **Image Loading Issues**
   - Check Firebase Storage rules
   - Verify image URLs
   - Check network connectivity

### Debug Tools
- Browser Developer Tools
- Firebase Console
- VS Code Debugger
- Console logging

## Contributing

### Development Workflow
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Create pull request
5. Code review
6. Merge to main

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Functionality works as expected
- [ ] No console errors
- [ ] Responsive design maintained
- [ ] Performance not degraded

## Resources

### Documentation
- [Firebase Documentation](https://firebase.google.com/docs)
- [JavaScript ES6+ Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [CSS Grid Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)

### Tools
- [Firebase Console](https://console.firebase.google.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [GitHub Repository](https://github.com/tanvirrrhasan/TanvirEmart)

## Support

For technical support or questions:
- Create an issue on GitHub
- Contact: tanviremart@gmail.com
- Developer: Tanvir Hasan

---

**Last Updated**: January 2025
**Version**: 1.0.0 