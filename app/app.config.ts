export default defineAppConfig({
    ui: {
        pageGrid: {
            base: 'relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'
        },
        pageCard: {
            slots: {
                root: 'relative flex rounded-lg overflow-hidden',
                spotlight: 'absolute inset-0 rounded-[inherit] pointer-events-none bg-default/90',
                container: 'relative flex flex-col flex-1 lg:grid gap-x-8 gap-y-4 p-4 sm:p-6',
                wrapper: 'flex flex-col flex-1 items-start',
                header: 'mb-4',
                body: 'flex-1',
                footer: 'pt-4 mt-auto',
                leading: 'inline-flex items-center mb-2.5',
                leadingIcon: 'size-5 shrink-0 text-primary',
                title: 'text-base text-pretty font-semibold text-highlighted',
                description: 'text-[15px] text-pretty'
            },
            variants: {
                orientation: {
                    horizontal: {
                        container: 'lg:grid-cols-2 lg:items-center'
                    },
                    vertical: {
                        container: ''
                    }
                },
                reverse: {
                    true: {
                        wrapper: 'lg:order-last'
                    }
                },
                variant: {
                    solid: {
                        root: 'bg-inverted text-inverted',
                        title: 'text-inverted',
                        description: 'text-dimmed'
                    },
                    outline: {
                        root: 'bg-default ring ring-default',
                        description: 'text-muted'
                    },
                    soft: {
                        root: 'bg-elevated/50',
                        description: 'text-toned'
                    },
                    subtle: {
                        root: 'bg-elevated/50 ring ring-default',
                        description: 'text-toned'
                    },
                    ghost: {
                        description: 'text-muted'
                    },
                    naked: {
                        container: 'p-0 sm:p-0',
                        description: 'text-muted'
                    },
                    outline_nopadding: {
                        container: 'p-0 sm:p-0',
                        root: 'bg-default ring ring-default',
                    }
                },
                to: {
                    true: {
                        root: [
                            'transition'
                        ]
                    }
                },
                title: {
                    true: {
                        description: 'mt-1'
                    }
                },
                highlight: {
                    true: {
                        root: 'ring-2'
                    }
                },
                highlightColor: {
                    primary: '',
                    secondary: '',
                    success: '',
                    info: '',
                    warning: '',
                    error: '',
                    neutral: ''
                },
                spotlight: {
                    true: {
                        root: '[--spotlight-size:400px] before:absolute before:-inset-px before:pointer-events-none before:rounded-[inherit] before:bg-[radial-gradient(var(--spotlight-size)_var(--spotlight-size)_at_calc(var(--spotlight-x,0px))_calc(var(--spotlight-y,0px)),var(--spotlight-color),transparent_70%)]'
                    }
                },
                spotlightColor: {
                    primary: '',
                    secondary: '',
                    success: '',
                    info: '',
                    warning: '',
                    error: '',
                    neutral: ''
                }
            },
            compoundVariants: [
                {
                    variant: 'solid',
                    to: true,
                    class: {
                        root: 'hover:bg-inverted/90'
                    }
                },
                {
                    variant: 'outline',
                    to: true,
                    class: {
                        root: 'hover:bg-elevated/50'
                    }
                },
                {
                    variant: 'soft',
                    to: true,
                    class: {
                        root: 'hover:bg-elevated'
                    }
                },
                {
                    variant: 'subtle',
                    to: true,
                    class: {
                        root: 'hover:bg-elevated'
                    }
                },
                {
                    variant: 'subtle',
                    to: true,
                    highlight: false,
                    class: {
                        root: 'hover:ring-accented'
                    }
                },
                {
                    variant: 'ghost',
                    to: true,
                    class: {
                        root: 'hover:bg-elevated/50'
                    }
                },
                {
                    highlightColor: 'primary',
                    highlight: true,
                    class: {
                        root: 'ring-primary'
                    }
                },
                {
                    highlightColor: 'neutral',
                    highlight: true,
                    class: {
                        root: 'ring-inverted'
                    }
                },
                {
                    spotlightColor: 'primary',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-primary)]'
                    }
                },
                {
                    spotlightColor: 'secondary',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-secondary)]'
                    }
                },
                {
                    spotlightColor: 'success',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-success)]'
                    }
                },
                {
                    spotlightColor: 'info',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-info)]'
                    }
                },
                {
                    spotlightColor: 'warning',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-warning)]'
                    }
                },
                {
                    spotlightColor: 'error',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-error)]'
                    }
                },
                {
                    spotlightColor: 'neutral',
                    spotlight: true,
                    class: {
                        root: '[--spotlight-color:var(--ui-bg-inverted)]'
                    }
                },
                {
                    to: true,
                    class: {
                        root: 'has-focus-visible:ring-2 has-focus-visible:ring-primary'
                    }
                }
            ],
            defaultVariants: {
                variant: 'outline',
                highlightColor: 'primary',
                spotlightColor: 'primary'
            }
        },
        card: {
            slots: {
                root: 'rounded-lg overflow-hidden',
                header: 'p-4 sm:px-6',
                body: 'p-4 sm:p-6',
                footer: 'p-4 sm:px-6'
            },
            variants: {
                variant: {
                    solid: {
                        root: 'bg-inverted text-inverted'
                    },
                    outline: {
                        root: 'bg-default ring ring-default divide-y divide-default'
                    },
                    soft: {
                        root: 'bg-elevated/50 divide-y divide-default'
                    },
                    subtle: {
                        root: 'bg-elevated/50 ring ring-default divide-y divide-default'
                    },
                    outline_nopadding: {
                        body: 'p-0 sm:p-0',
                        root: 'bg-default ring ring-default divide-y divide-default',
                    }
                }
            },
            defaultVariants: {
                variant: 'outline'
            }
        }
    }
})
