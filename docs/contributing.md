# 🤝 Contributing Guide

Welcome to the Delight Bakehouse project! This guide will help you get started with contributing to our bakery order management system.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Review Process](#review-process)
- [Community](#community)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a positive community
- Report any unacceptable behavior

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **Git** for version control
- **Firebase CLI** (`npm install -g firebase-tools`)
- **VS Code** (recommended) with TypeScript and React extensions

### Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/delight-bakehouse.git
   cd delight-bakehouse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase (for development)**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase config
   firebase use --add  # Select your dev project
   ```

4. **Start development**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branching Strategy

We use a simplified Git flow:

```
main (production-ready)
├── develop (integration branch)
│   ├── feature/feature-name
│   ├── bugfix/bug-description
│   └── hotfix/critical-fix
```

### Creating a Feature Branch

```bash
# Create and switch to feature branch
git checkout -b feature/your-feature-name

# Push to remote
git push -u origin feature/your-feature-name
```

### Development Process

1. **Choose an issue** from our issue tracker
2. **Create a feature branch** from `develop`
3. **Implement your changes** following our standards
4. **Write tests** for new functionality
5. **Test locally** with emulators
6. **Commit with clear messages**
7. **Create a pull request**

## Code Standards

### TypeScript/JavaScript

- **TypeScript first**: All new code must be TypeScript
- **Strict mode**: No `any` types without justification
- **Interface over type**: Use interfaces for object shapes
- **Functional components**: Prefer React functional components with hooks

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

const UserCard: React.FC<{ user: User }> = ({ user }) => {
  return <div>{user.name}</div>;
};

// ❌ Avoid
type User = any;

const UserCard = ({ user }) => {
  return <div>{user.name}</div>;
};
```

### React Best Practices

- **Custom hooks**: Extract reusable logic into custom hooks
- **Component composition**: Prefer composition over inheritance
- **Props interface**: Always define component props interfaces
- **Error boundaries**: Use error boundaries for error handling

```typescript
// ✅ Good
const useUserData = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
};

interface UserCardProps {
  userId: string;
  onEdit?: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ userId, onEdit }) => {
  const { data: user } = useUserData(userId);

  return (
    <div>
      <h3>{user?.name}</h3>
      {onEdit && <button onClick={onEdit}>Edit</button>}
    </div>
  );
};
```

### Firebase Best Practices

- **Security rules**: Always update security rules with schema changes
- **Indexes**: Add required Firestore indexes for new queries
- **Batch operations**: Use batch writes for multiple related operations
- **Real-time listeners**: Clean up listeners to prevent memory leaks

```typescript
// ✅ Good
const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', userId);

  batch.update(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
};

// Cleanup listeners
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // handle updates
  });

  return unsubscribe;
}, []);
```

### Styling

- **Tailwind CSS**: Use utility classes for styling
- **Component-scoped**: Avoid global styles
- **Responsive design**: Mobile-first approach
- **Consistent spacing**: Use Tailwind spacing scale

```typescript
// ✅ Good
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
    {children}
  </div>
);

// ❌ Avoid
const Card = ({ children }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '8px' }}>
    {children}
  </div>
);
```

## Testing

### Testing Strategy

- **Unit tests**: Test individual functions and hooks
- **Integration tests**: Test component interactions
- **E2E tests**: Test complete user workflows
- **Smoke tests**: Quick validation of core functionality

### Writing Tests

```typescript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('displays user name', () => {
    const user = { id: '1', name: 'John Doe', email: 'john@example.com' };
    render(<UserCard user={user} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    const user = { id: '1', name: 'John Doe', email: 'john@example.com' };
    render(<UserCard user={user} onEdit={onEdit} />);

    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run smoke tests
npm run test:smoke
```

## Submitting Changes

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(auth): add Google OAuth login
fix(order): resolve payment calculation bug
docs(readme): update installation instructions
refactor(components): extract reusable form components
```

### Pull Request Process

1. **Ensure your branch is up to date**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout your-feature-branch
   git rebase develop
   ```

2. **Run quality checks**
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

3. **Create pull request**
   - Use descriptive title
   - Fill out PR template
   - Link related issues
   - Add screenshots for UI changes

4. **PR Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] Manual testing completed

   ## Screenshots
   <!-- Add screenshots for UI changes -->

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Tests pass
   - [ ] Documentation updated
   - [ ] No breaking changes
   ```

## Review Process

### Code Review Guidelines

**Reviewers will check for:**
- Code correctness and functionality
- Adherence to coding standards
- Test coverage and quality
- Performance implications
- Security considerations
- Documentation updates

**Common feedback areas:**
- Type safety issues
- Performance bottlenecks
- Security vulnerabilities
- Code maintainability
- Test coverage gaps

### Addressing Feedback

1. **Review comments** carefully
2. **Make requested changes** or provide justification
3. **Update tests** if needed
4. **Re-request review** when changes are complete

### Merging

Once approved:
- **Squash merge** for clean history
- **Delete feature branch** after merge
- **Close related issues** with reference

## Community

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Request Comments**: Code review discussions

### Getting Help

- Check existing issues and documentation first
- Use clear, descriptive language
- Provide code examples and error messages
- Include environment details (OS, Node version, etc.)

### Recognition

Contributors are recognized through:
- GitHub contributor statistics
- Mention in release notes
- Attribution in documentation

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

Thank you for contributing to Delight Bakehouse! Your efforts help make bakery management better for businesses worldwide.

**Last updated:** December 2024