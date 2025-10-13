import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, type ChangeEvent, useTransition } from 'react';
import { FaMale, FaFemale } from 'react-icons/fa';
import useFilterStore from './useFilterStore';
import type { Selection } from '@nextui-org/react';
import usePaginationStore from './usePaginationStore';

export const useFilters = () => {
    const pathname = usePathname();
    const router = useRouter();

    const { filters, setFilters } = useFilterStore();

    const { pageNumber, pageSize, setPage, totalCount } = usePaginationStore(state => ({
        pageNumber: state.pagination.pageNumber,
        pageSize: state.pagination.pageSize,
        setPage: state.setPage,
        totalCount: state.pagination.totalCount
    }))


    const { gender, ageRange, orderBy } = filters;

    const [isPending, startTransition] = useTransition();


    useEffect(() => {
        if (gender || ageRange || orderBy) {
            setPage(1);
        }
    }, [gender, ageRange, orderBy, setPage])

    useEffect(() => {
        startTransition(() => {
            const searchParams = new URLSearchParams();

            if (gender) searchParams.set('gender', gender.join(','));
            if (ageRange) searchParams.set('ageRange', ageRange.toString());
            if (orderBy) searchParams.set('orderBy', orderBy);
            if (pageSize) searchParams.set('pageSize', pageSize.toString());
            if (pageNumber) searchParams.set('pageNumber', pageNumber.toString());


            router.replace(`${pathname}?${searchParams}`);
        })
    }, [ageRange, orderBy, gender, router, pathname, pageNumber, pageSize])

    const orderByList = [
        { label: 'Last active', value: 'updated' },
        { label: 'Newest members', value: 'created' },
    ]

    const genderList = [
        { value: 'male', icon: FaMale },
        { value: 'female', icon: FaFemale },
    ]

    const handleAgeSelect = (value: number[]) => {
        setFilters('ageRange', value);
    }

    const handleOrderSelect = (value: Selection | string) => {
        if (value instanceof Set) {
            setFilters('orderBy', value.values().next().value);
        } else if (typeof value === 'string') {
            setFilters('orderBy', value);
        }
    }

    const handleGenderSelect = (value: string) => {
        if (gender.includes(value)) setFilters('gender', gender.filter(genderValue => genderValue !== value));
        else setFilters('gender', [...gender, value]);
    }



    return {
        orderByList,
        genderList,
        selectAge: handleAgeSelect,
        selectGender: handleGenderSelect,
        selectOrder: handleOrderSelect,

        filters,
        totalCount,
        isPending
    }
}