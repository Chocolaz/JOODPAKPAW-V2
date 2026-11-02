import { Afacad, Baloo_2, Inter, Sarabun, Prompt } from 'next/font/google'

export const afacad = Afacad({
  subsets: ['latin'],
  variable: '--font-afacad',
})

export const baloo2 = Baloo_2({
  subsets: ['latin'],
  variable: '--font-baloo2',
})

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const sarabun = Sarabun({
  subsets: ['thai'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sarabun',
})

export const prompt = Prompt({
  subsets: ['thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-prompt',
})
