/** "1 video", "3 videos": count + noun with the right plural. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const nVideos = (n: number) => plural(n, 'video')
