# SVG Icons

This folder is for storing your SVG icon files.

## How to add a new icon

1.  Simply drop your `.svg` files into this directory.

## How to use an icon

You can use the icons in your components in a few ways:

### 1. Using `next/image` Component (Recommended)

This is the recommended way to use images in Next.js as it provides automatic optimization.

```tsx
import Image from 'next/image'

const MyComponent = () => (
  <div>
    <Image src="/icons/my-icon.svg" alt="My Icon" width={24} height={24} />
  </div>
)
```

### 2. Using a regular `<img>` tag

```tsx
const MyComponent = () => (
  <div>
    <img src="/icons/my-icon.svg" alt="My Icon" width="24" height="24" />
  </div>
)
```

Replace `my-icon.svg` with the actual filename of your icon.
